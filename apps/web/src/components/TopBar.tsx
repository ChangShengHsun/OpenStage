import { useState } from 'react';
import type { ReactElement } from 'react';
import { useEditor } from '../state/store';
import { formatEightCount, formatTimecode } from '../state/interpolate';
import { getLocalUser, setLocalUserName } from '../state/user';
import {
  collabRoom,
  followedPeerId,
  isCollabActive,
  setAwarenessUser,
  setFollowPeer,
} from '../collab/collab';
import { usePeers } from '../hooks/usePeers';
import { isViewMode } from '../state/viewMode';
import { useLocaleStore, useT } from '../i18n';
import { ExportDialog } from './ExportDialog';

export function TopBar(): ReactElement {
  const t = useT();
  const locale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);
  const title = useEditor((s) => s.performance.title);
  const bpm = useEditor((s) => s.performance.bpm);
  const countSegments = useEditor((s) => s.performance.countSegments);
  const setTitle = useEditor((s) => s.setTitle);
  const playheadMs = useEditor((s) => s.playheadMs);
  const undo = useEditor((s) => s.undo);
  const redo = useEditor((s) => s.redo);
  const eightCount = bpm !== null ? formatEightCount(playheadMs, bpm, countSegments) : null;

  const peers = usePeers();
  const [userName, setUserName] = useState(() => getLocalUser().name);
  const [shareNote, setShareNote] = useState('');

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
      <button type="button" className="btn edit-only" onClick={undo} title={t.topbar.undoTitle}>
        {t.topbar.undo}
      </button>
      <button type="button" className="btn edit-only" onClick={redo} title={t.topbar.redoTitle}>
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
          {peers.map((p) => {
            const following = followedPeerId() === p.clientId;
            return (
              <button
                key={p.clientId}
                type="button"
                className={`presence-follow${following ? ' following' : ''}`}
                title={following ? t.topbar.unfollow(p.name) : t.topbar.follow(p.name)}
                aria-pressed={following}
                onClick={() => setFollowPeer(following ? null : p.clientId)}
              >
                <span className="presence-dot" style={{ background: p.color }} />
              </button>
            );
          })}
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
        {eightCount !== null ? `  ${eightCount}` : ''}
      </span>
      <ExportDialog />
    </header>
  );
}
