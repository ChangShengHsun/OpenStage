import { useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, ReactElement } from 'react';
import { registerVideoElement, useRefVideo } from '../state/refVideo';
import { useEditor } from '../state/store';
import { NumberField } from './NumberField';
import { CalibrationOverlay } from './CalibrationOverlay';
import { useT } from '../i18n';

/**
 * The reference-video panel (docs/ref-video-sync-design.md). One <video>
 * element shared by both layouts — the wrapper's class switches between a
 * draggable PiP window and a split pane, so toggling never resets playback.
 * The timeline is the only transport: no native video controls.
 */
export function RefVideo(): ReactElement | null {
  const t = useT();
  const objectUrl = useRefVideo((s) => s.objectUrl);
  const fileName = useRefVideo((s) => s.fileName);
  const offsetMs = useRefVideo((s) => s.offsetMs);
  const layout = useRefVideo((s) => s.layout);
  const setOffsetMs = useRefVideo((s) => s.setOffsetMs);
  const setLayout = useRefVideo((s) => s.setLayout);
  const clear = useRefVideo((s) => s.clear);
  const calibrating = useRefVideo((s) => s.calibrating);
  const setCalibrating = useRefVideo((s) => s.setCalibrating);
  const corners = useRefVideo((s) => s.corners);
  const [error, setError] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [captureNote, setCaptureNote] = useState('');
  const [scanProgress, setScanProgress] = useState<number | null>(null);
  const scanAbortRef = useRef<AbortController | null>(null);
  // PiP position, draggable by the header (session-local, default bottom-left).
  const [pos, setPos] = useState({ left: 12, bottom: 12 });
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    baseLeft: number;
    baseBottom: number;
  } | null>(null);

  if (objectUrl === null) return null;

  const onHeaderPointerDown = (e: ReactPointerEvent<HTMLDivElement>): void => {
    if (layout !== 'pip') return;
    // Capturing on a button press would swallow its click — buttons opt out.
    if (e.target instanceof Element && e.target.closest('button') !== null) return;
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      baseLeft: pos.left,
      baseBottom: pos.bottom,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onHeaderPointerMove = (e: ReactPointerEvent<HTMLDivElement>): void => {
    const d = dragRef.current;
    if (d === null) return;
    setPos({
      left: d.baseLeft + (e.clientX - d.startX),
      bottom: d.baseBottom - (e.clientY - d.startY),
    });
  };
  const onHeaderPointerUp = (): void => {
    dragRef.current = null;
  };

  return (
    <div
      className={layout === 'pip' ? 'ref-video-pip' : 'ref-video-splitpane'}
      style={layout === 'pip' ? { left: pos.left, bottom: pos.bottom } : undefined}
      aria-label={t.refVideo.panelAria}
    >
      <div
        className="ref-video-head"
        onPointerDown={onHeaderPointerDown}
        onPointerMove={onHeaderPointerMove}
        onPointerUp={onHeaderPointerUp}
        title={layout === 'pip' ? t.refVideo.dragHint : undefined}
      >
        <span className="ref-video-name">{fileName}</span>
        <button
          type="button"
          className="btn"
          title={t.refVideo.layoutTitle}
          onClick={() => setLayout(layout === 'pip' ? 'split' : 'pip')}
        >
          {layout === 'pip' ? t.refVideo.toSplit : t.refVideo.toPip}
        </button>
        <button type="button" className="btn" onClick={clear}>
          {t.refVideo.close}
        </button>
      </div>
      {error ? (
        <p className="empty-note" role="alert">
          {t.refVideo.formatError}
        </p>
      ) : (
        <div className="ref-video-frame">
          <video
            ref={(el) => {
              videoRef.current = el;
              registerVideoElement(el);
            }}
            className="ref-video-el"
            src={objectUrl}
            playsInline
            preload="auto"
            onError={() => setError(true)}
          />
          {calibrating && <CalibrationOverlay videoRef={videoRef} />}
        </div>
      )}
      <div className="ref-video-controls">
        <label htmlFor="ref-video-offset" title={t.refVideo.offsetTitle}>
          {t.refVideo.offsetLabel}
        </label>
        <NumberField
          id="ref-video-offset"
          step={0.1}
          decimals={2}
          style={{ width: 72 }}
          value={offsetMs / 1000}
          onCommit={(v) => setOffsetMs(v * 1000)}
        />
        <button
          type="button"
          className="btn"
          title={t.refVideo.alignTitle}
          onClick={() => {
            const video = videoRef.current;
            if (video === null) return;
            setOffsetMs(video.currentTime * 1000 - useEditor.getState().playheadMs);
          }}
        >
          {t.refVideo.alignHere}
        </button>
        <button
          type="button"
          className={`btn${calibrating ? ' btn-active' : ''}`}
          aria-pressed={calibrating}
          title={t.refVideo.calibrateTitle}
          onClick={() => setCalibrating(!calibrating)}
        >
          {calibrating ? t.refVideo.calibrateDone : t.refVideo.calibrate}
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={corners === null || capturing}
          title={corners === null ? t.refVideo.captureNeedsCalibration : t.refVideo.captureTitle}
          onClick={() => {
            const video = videoRef.current;
            if (video === null || corners === null) return;
            setCapturing(true);
            setCaptureNote(t.refVideo.captureRunning);
            void (async () => {
              const { captureAtTime } = await import('../vision/capture');
              const s = useEditor.getState();
              const fid = s.selectedFormationId;
              const current = s.positions[fid] ?? {};
              const reference = s.performers
                .map((p) => {
                  const pos = current[p.id];
                  return pos === undefined
                    ? null
                    : { performerId: p.id, x: pos.x, y: pos.y };
                })
                .filter((r): r is { performerId: string; x: number; y: number } => r !== null);
              const result = await captureAtTime(
                video,
                corners,
                s.performance.stageWidth,
                s.performance.stageHeight,
                reference,
                { withFacing: true },
              );
              if (result === 'no-calibration') {
                setCaptureNote(t.refVideo.degenerateCorners);
              } else if (result === 'no-people') {
                setCaptureNote(t.refVideo.captureNoPeople);
              } else {
                s.setPositionsBulk(fid, result.positions);
                s.setPerformerSelection(result.uncertainIds);
                setCaptureNote(
                  t.refVideo.captureDone(
                    Object.keys(result.positions).length,
                    result.uncertainIds.length,
                  ),
                );
              }
              window.setTimeout(() => setCaptureNote(''), 6000);
            })()
              .catch((err: unknown) => {
                setCaptureNote(err instanceof Error ? err.message : String(err));
                window.setTimeout(() => setCaptureNote(''), 6000);
              })
              .finally(() => setCapturing(false));
          }}
        >
          {t.refVideo.capture}
        </button>
        <button
          type="button"
          className="btn"
          disabled={corners === null || capturing}
          title={corners === null ? t.refVideo.captureNeedsCalibration : t.refVideo.scanTitle}
          onClick={() => {
            if (scanProgress !== null) {
              scanAbortRef.current?.abort(); // second click = cancel
              return;
            }
            const video = videoRef.current;
            if (video === null || corners === null) return;
            const controller = new AbortController();
            scanAbortRef.current = controller;
            setScanProgress(0);
            void (async () => {
              const { scanVideo } = await import('../vision/scan');
              const s = useEditor.getState();
              const fid = s.selectedFormationId;
              const current = s.positions[fid] ?? {};
              const reference = s.performers
                .map((p) => {
                  const pos = current[p.id];
                  return pos === undefined
                    ? null
                    : { performerId: p.id, x: pos.x, y: pos.y };
                })
                .filter((r): r is { performerId: string; x: number; y: number } => r !== null);
              const held = await scanVideo(video, {
                offsetMs: useRefVideo.getState().offsetMs,
                stageWidth: s.performance.stageWidth,
                stageHeight: s.performance.stageHeight,
                corners,
                reference,
                onProgress: setScanProgress,
                signal: controller.signal,
              });
              if (held === null) {
                setCaptureNote(t.refVideo.scanCancelled);
              } else if (held.length === 0) {
                setCaptureNote(t.refVideo.scanNothing);
              } else {
                s.applyScanFormations(held);
                setCaptureNote(t.refVideo.scanDone(held.length));
              }
              window.setTimeout(() => setCaptureNote(''), 6000);
            })()
              .catch((err: unknown) => {
                setCaptureNote(err instanceof Error ? err.message : String(err));
                window.setTimeout(() => setCaptureNote(''), 6000);
              })
              .finally(() => setScanProgress(null));
          }}
        >
          {scanProgress === null
            ? t.refVideo.scan
            : t.refVideo.scanCancel(Math.round(scanProgress * 100))}
        </button>
      </div>
      {captureNote !== '' && (
        <p className="ref-video-note" role="status">
          {captureNote}
        </p>
      )}
    </div>
  );
}
