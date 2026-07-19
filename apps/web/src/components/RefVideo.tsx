import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, ReactElement } from 'react';
import { isPerformerActive } from '@gridstage/shared-types';
import { registerVideoElement, useRefVideo } from '../state/refVideo';
import { useEditor } from '../state/store';
import { posesAtTime } from '../state/interpolate';
import type { ReviewReport } from '../vision/review';
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
  // Rehearsal review (M3): detected-vs-plan report for the paused frame.
  const [review, setReview] = useState<{ report: ReviewReport; timecode: string } | null>(null);
  // PiP position + width, draggable/resizable (session-local, default
  // bottom-left). Height follows the width (video keeps its aspect ratio).
  const [pos, setPos] = useState({ left: 12, bottom: 12 });
  const [pipWidth, setPipWidth] = useState(340);
  const splitRatio = useRefVideo((s) => s.splitRatio);
  const setSplitRatio = useRefVideo((s) => s.setSplitRatio);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    baseLeft: number;
    baseBottom: number;
  } | null>(null);
  const resizeRef = useRef<{ startX: number; baseWidth: number } | null>(null);
  // Native Fullscreen API — gives calibration the whole screen to work in.
  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => {
    const onChange = (): void => setIsFullscreen(document.fullscreenElement === panelRef.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  if (objectUrl === null) return null;

  /** Keep the PiP window fully inside the stage area (its offset parent). */
  const clampPos = (left: number, bottom: number): { left: number; bottom: number } => {
    const panel = panelRef.current;
    const parent = panel?.parentElement;
    if (panel == null || parent == null) return { left, bottom };
    return {
      left: Math.min(Math.max(left, 0), Math.max(0, parent.clientWidth - panel.offsetWidth)),
      bottom: Math.min(Math.max(bottom, 0), Math.max(0, parent.clientHeight - panel.offsetHeight)),
    };
  };

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
    setPos(clampPos(d.baseLeft + (e.clientX - d.startX), d.baseBottom - (e.clientY - d.startY)));
  };
  const onHeaderPointerUp = (): void => {
    dragRef.current = null;
  };

  const onResizePointerDown = (e: ReactPointerEvent<HTMLDivElement>): void => {
    resizeRef.current = { startX: e.clientX, baseWidth: pipWidth };
    e.currentTarget.setPointerCapture(e.pointerId);
    e.stopPropagation();
  };
  const onResizePointerMove = (e: ReactPointerEvent<HTMLDivElement>): void => {
    const r = resizeRef.current;
    if (r === null) return;
    const parentW = panelRef.current?.parentElement?.clientWidth ?? Number.POSITIVE_INFINITY;
    setPipWidth(Math.min(Math.max(r.baseWidth + (e.clientX - r.startX), 220), parentW * 0.7));
  };
  const onResizePointerUp = (): void => {
    resizeRef.current = null;
    setPos((p) => clampPos(p.left, p.bottom)); // wider panel may now stick out
  };

  const onDividerPointerDown = (e: ReactPointerEvent<HTMLDivElement>): void => {
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onDividerPointerMove = (e: ReactPointerEvent<HTMLDivElement>): void => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    const parent = panelRef.current?.parentElement;
    if (parent == null) return;
    const rect = parent.getBoundingClientRect();
    if (rect.width > 0) setSplitRatio((e.clientX - rect.left) / rect.width);
  };

  return (
    <div
      ref={panelRef}
      className={layout === 'pip' ? 'ref-video-pip' : 'ref-video-splitpane'}
      style={
        layout === 'pip'
          ? { left: pos.left, bottom: pos.bottom, width: pipWidth }
          : { width: `${splitRatio * 100}%` }
      }
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
        {document.fullscreenEnabled && (
          <button
            type="button"
            className="btn"
            aria-pressed={isFullscreen}
            aria-label={isFullscreen ? t.refVideo.fullscreenExit : t.refVideo.fullscreen}
            title={isFullscreen ? t.refVideo.fullscreenExit : t.refVideo.fullscreen}
            onClick={() => {
              if (isFullscreen) void document.exitFullscreen();
              else void panelRef.current?.requestFullscreen();
            }}
          >
            ⛶
          </button>
        )}
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
        <div className={`ref-video-frame${calibrating ? ' ref-video-frame-calibrating' : ''}`}>
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
                .filter(isPerformerActive)
                .map((p) => {
                  const pos = current[p.id];
                  return pos === undefined ? null : { performerId: p.id, x: pos.x, y: pos.y };
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
                .filter(isPerformerActive)
                .map((p) => {
                  const pos = current[p.id];
                  return pos === undefined ? null : { performerId: p.id, x: pos.x, y: pos.y };
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
              } else if (
                !window.confirm(t.refVideo.scanReplaceConfirm(held.length, s.formations.length))
              ) {
                setCaptureNote(t.refVideo.scanCancelled);
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
        <button
          type="button"
          className="btn"
          disabled={corners === null || capturing}
          title={corners === null ? t.refVideo.captureNeedsCalibration : t.refVideo.reviewTitle}
          onClick={() => {
            const video = videoRef.current;
            if (video === null || corners === null) return;
            setCapturing(true);
            void (async () => {
              const { captureAtTime } = await import('../vision/capture');
              const { reviewFrame } = await import('../vision/review');
              const { formatTimecode } = await import('../state/interpolate');
              const s = useEditor.getState();
              // The PLAN is the interpolated chart at the playhead — that is
              // what the paused frame is supposed to look like.
              const plan = posesAtTime(s.formations, s.positions, s.playheadMs);
              const reference = s.performers
                .filter(isPerformerActive)
                .map((p) => {
                  const pose = plan.get(p.id);
                  return pose === undefined ? null : { performerId: p.id, x: pose.x, y: pose.y };
                })
                .filter((r): r is { performerId: string; x: number; y: number } => r !== null);
              if (reference.length === 0) {
                setCaptureNote(t.refVideo.reviewNoPlan);
                window.setTimeout(() => setCaptureNote(''), 6000);
                return;
              }
              const result = await captureAtTime(
                video,
                corners,
                s.performance.stageWidth,
                s.performance.stageHeight,
                reference,
              );
              if (result === 'no-calibration') {
                setCaptureNote(t.refVideo.degenerateCorners);
                window.setTimeout(() => setCaptureNote(''), 6000);
              } else if (result === 'no-people') {
                setCaptureNote(t.refVideo.captureNoPeople);
                window.setTimeout(() => setCaptureNote(''), 6000);
              } else {
                const planRecord = Object.fromEntries(
                  reference.map((r) => [r.performerId, { x: r.x, y: r.y }]),
                );
                const centerId =
                  s.selectedPerformerIds.length === 1 ? (s.selectedPerformerIds[0] ?? null) : null;
                setReview({
                  report: reviewFrame(result.positions, planRecord, {
                    axisX: s.performance.stageWidth / 2,
                    centerPerformerId: centerId,
                  }),
                  timecode: formatTimecode(s.playheadMs),
                });
              }
            })()
              .catch((err: unknown) => {
                setCaptureNote(err instanceof Error ? err.message : String(err));
                window.setTimeout(() => setCaptureNote(''), 6000);
              })
              .finally(() => setCapturing(false));
          }}
        >
          {t.refVideo.review}
        </button>
      </div>
      {captureNote !== '' && (
        <p className="ref-video-note" role="status">
          {captureNote}
        </p>
      )}
      {review !== null && <ReviewNote review={review} onClose={() => setReview(null)} />}
      {layout === 'pip' && (
        <div
          className="ref-video-resize"
          role="separator"
          aria-label={t.refVideo.resizeAria}
          title={t.refVideo.resizeAria}
          onPointerDown={onResizePointerDown}
          onPointerMove={onResizePointerMove}
          onPointerUp={onResizePointerUp}
        />
      )}
      {layout === 'split' && (
        <div
          className="ref-video-divider"
          role="separator"
          aria-label={t.refVideo.splitDividerAria}
          title={t.refVideo.splitDividerAria}
          onPointerDown={onDividerPointerDown}
          onPointerMove={onDividerPointerMove}
        />
      )}
    </div>
  );
}

/** The M3 report, rendered as a compact list under the video controls. */
function ReviewNote({
  review,
  onClose,
}: {
  review: { report: ReviewReport; timecode: string };
  onClose: () => void;
}): ReactElement {
  const t = useT();
  const performers = useEditor((s) => s.performers);
  const nameOf = (id: string): string => performers.find((p) => p.id === id)?.name ?? '?';
  const side = (dx: number): string => (dx > 0 ? t.refVideo.reviewRight : t.refVideo.reviewLeft);
  const depth = (dy: number): string =>
    dy > 0 ? t.refVideo.reviewDownstage : t.refVideo.reviewUpstage;
  const { report } = review;
  const worst = report.perDancer[0];

  return (
    <div className="ref-video-note review-report" role="status">
      <div className="comment-head">
        <span className="comment-author">{t.refVideo.reviewHeader(review.timecode)}</span>
        <button type="button" className="comment-delete" onClick={onClose}>
          ×
        </button>
      </div>
      <div>{t.refVideo.reviewMean(report.meanOffsetM.toFixed(2))}</div>
      {report.centerDxM !== null && report.centerPerformerId !== null ? (
        <div>
          {t.refVideo.reviewCenter(
            nameOf(report.centerPerformerId),
            Math.abs(report.centerDxM).toFixed(2),
            side(report.centerDxM),
          )}
        </div>
      ) : (
        <div>{t.refVideo.reviewCenterNone}</div>
      )}
      {report.asymmetryM !== null && (
        <div>{t.refVideo.reviewAsymmetry(report.asymmetryM.toFixed(2))}</div>
      )}
      {worst !== undefined &&
        report.perDancer.slice(0, 5).map((d) => (
          <div key={d.performerId} className="mono">
            {t.refVideo.reviewDancer(
              nameOf(d.performerId),
              d.offsetM.toFixed(2),
              `${side(d.dxM)} ${Math.abs(d.dxM).toFixed(1)} · ${depth(d.dyM)} ${Math.abs(d.dyM).toFixed(1)}`,
            )}
          </div>
        ))}
    </div>
  );
}
