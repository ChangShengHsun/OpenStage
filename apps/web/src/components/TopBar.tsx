import { useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { useEditor } from '../state/store';
import { formatEightCount, formatTimecode } from '../state/interpolate';
import { getLocalUser, setLocalUserName } from '../state/user';
import { collabRoom, isCollabActive, setAwarenessUser } from '../collab/collab';
import { usePeers } from '../hooks/usePeers';
import { isViewMode } from '../state/viewMode';
import { useLocaleStore, useT } from '../i18n';

interface TopBarProps {
  onTogglePlay: () => void;
  onExportPdf: () => void;
}

/** 0.5×–2.0× in 0.1 steps ((5+i)/10 avoids float drift like 0.7000…01). */
const PLAYBACK_SPEEDS = Array.from({ length: 16 }, (_, i) => (5 + i) / 10);

export function TopBar({ onTogglePlay, onExportPdf }: TopBarProps): ReactElement {
  const t = useT();
  const locale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);
  const title = useEditor((s) => s.performance.title);
  const bpm = useEditor((s) => s.performance.bpm);
  const setTitle = useEditor((s) => s.setTitle);
  const isPlaying = useEditor((s) => s.isPlaying);
  const playheadMs = useEditor((s) => s.playheadMs);
  const playbackRate = useEditor((s) => s.playbackRate);
  const setPlaybackRate = useEditor((s) => s.setPlaybackRate);
  const undo = useEditor((s) => s.undo);
  const redo = useEditor((s) => s.redo);

  const peers = usePeers();
  const [userName, setUserName] = useState(() => getLocalUser().name);
  const [shareNote, setShareNote] = useState('');
  const [videoProgress, setVideoProgress] = useState<number | null>(null);
  const videoAbortRef = useRef<AbortController | null>(null);

  const onExportVideo = (): void => {
    if (videoProgress !== null) {
      videoAbortRef.current?.abort(); // second click = cancel
      return;
    }
    const controller = new AbortController();
    videoAbortRef.current = controller;
    setVideoProgress(0);
    void import('../export/video')
      .then((m) =>
        m.exportPerformanceVideo({ onProgress: setVideoProgress, signal: controller.signal }),
      )
      .catch((err: unknown) => {
        setShareNote(err instanceof Error ? err.message : t.topbar.videoExportFailed);
        window.setTimeout(() => setShareNote(''), 4000);
      })
      .finally(() => setVideoProgress(null));
  };

  const onShare = (): void => {
    if (!isCollabActive()) {
      const roomId = crypto.randomUUID().slice(0, 8);
      const url = new URL(window.location.href);
      url.searchParams.set('room', roomId);
      window.location.href = url.toString(); // reload into the session
      return;
    }
    void navigator.clipboard.writeText(window.location.href).then(
      () => setShareNote(t.topbar.linkCopied),
      () => setShareNote(window.location.href),
    );
    window.setTimeout(() => setShareNote(''), 2500);
  };

  return (
    <header className="topbar">
      <span className="wordmark">
        Open<em>Stage</em>
      </span>
      <input
        type="text"
        aria-label={t.topbar.performanceTitleAria}
        value={title}
        readOnly={isViewMode}
        onChange={(e) => setTitle(e.target.value)}
        style={{ width: 200 }}
      />
      <button
        type="button"
        className="btn edit-only"
        onClick={undo}
        title={t.topbar.undoTitle}
      >
        {t.topbar.undo}
      </button>
      <button
        type="button"
        className="btn edit-only"
        onClick={redo}
        title={t.topbar.redoTitle}
      >
        {t.topbar.redo}
      </button>
      <span className="topbar-spacer" />
      {isCollabActive() && (
        <span className="presence" aria-label={t.topbar.peopleInSession(peers.length + 1)}>
          <span
            className="presence-dot"
            style={{ background: getLocalUser().color }}
            title={t.topbar.youTag(getLocalUser().name)}
          />
          {peers.map((p) => (
            <span
              key={p.clientId}
              className="presence-dot"
              style={{ background: p.color }}
              title={p.name}
            />
          ))}
        </span>
      )}
      <input
        type="text"
        aria-label={t.topbar.displayNameAria}
        title={t.topbar.displayNameTitle}
        value={userName}
        style={{ width: 110 }}
        onChange={(e) => setUserName(e.target.value)}
        onBlur={() => {
          const user = setLocalUserName(userName);
          setUserName(user.name);
          setAwarenessUser(user.name, user.color);
        }}
      />
      <select
        aria-label={t.locale.label}
        value={locale}
        style={{ width: 96 }}
        onChange={(e) => setLocale(e.target.value === 'zh' ? 'zh' : 'en')}
      >
        <option value="en">{t.locale.english}</option>
        <option value="zh">{t.locale.chinese}</option>
      </select>
      <button type="button" className="btn edit-only" onClick={onShare}>
        {isCollabActive() ? t.topbar.copyLink(collabRoom() ?? '') : t.topbar.shareLive}
      </button>
      {isCollabActive() && !isViewMode && (
        <button
          type="button"
          className="btn"
          title={t.topbar.viewLinkTitle}
          onClick={() => {
            const url = new URL(window.location.href);
            url.searchParams.set('mode', 'view');
            void navigator.clipboard.writeText(url.toString()).then(
              () => setShareNote(t.topbar.viewLinkCopied),
              () => setShareNote(url.toString()),
            );
            window.setTimeout(() => setShareNote(''), 2500);
          }}
        >
          {t.topbar.viewLink}
        </button>
      )}
      {shareNote !== '' && (
        <span className="mono" role="status">
          {shareNote}
        </span>
      )}
      <span className="timecode" aria-label={t.topbar.playheadAria}>
        {formatTimecode(playheadMs)}
        {bpm !== null ? `  ${formatEightCount(playheadMs, bpm)}` : ''}
      </span>
      <select
        aria-label={t.topbar.playbackSpeedAria}
        title={t.topbar.playbackSpeedAria}
        value={playbackRate.toFixed(1)}
        style={{ width: 66 }}
        onChange={(e) => setPlaybackRate(Number(e.target.value))}
      >
        {PLAYBACK_SPEEDS.map((rate) => (
          <option key={rate} value={rate.toFixed(1)}>
            {rate.toFixed(1)}×
          </option>
        ))}
      </select>
      <button type="button" className="btn btn-primary" onClick={onTogglePlay}>
        {isPlaying ? t.topbar.pause : t.topbar.play}
      </button>
      <button type="button" className="btn" onClick={onExportPdf}>
        {t.topbar.exportPdf}
      </button>
      <button
        type="button"
        className="btn"
        onClick={onExportVideo}
        title={t.topbar.exportVideoTitle}
      >
        {videoProgress === null
          ? t.topbar.exportVideo
          : t.topbar.exportVideoCancel(Math.round(videoProgress * 100))}
      </button>
    </header>
  );
}
