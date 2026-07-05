import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, ReactElement } from 'react';
import { useEditor } from '../state/store';
import { byOrder, showEndMs } from '../state/interpolate';
import { audioDurationMs, getAudioElement, getWaveformPeaks } from '../audio/audioPlayer';

const MIN_TIMELINE_MS = 30_000;
const WAVEFORM_BINS = 600;

interface TimelineProps {
  /** Bumped by the app whenever audio is loaded/cleared, to redraw the waveform. */
  audioVersion: number;
  onUploadAudio: () => void;
  onClearAudio: () => void;
}

export function Timeline({
  audioVersion,
  onUploadAudio,
  onClearAudio,
}: TimelineProps): ReactElement {
  const formations = useEditor((s) => s.formations);
  const beatMarkersMs = useEditor((s) => s.performance.beatMarkersMs);
  const bpm = useEditor((s) => s.performance.bpm);
  const selectedFormationId = useEditor((s) => s.selectedFormationId);
  const playheadMs = useEditor((s) => s.playheadMs);
  const isPlaying = useEditor((s) => s.isPlaying);
  const addFormation = useEditor((s) => s.addFormation);
  const selectFormation = useEditor((s) => s.selectFormation);
  const setPlayhead = useEditor((s) => s.setPlayhead);
  const addBeatMarker = useEditor((s) => s.addBeatMarker);
  const removeBeatMarker = useEditor((s) => s.removeBeatMarker);

  const bodyRef = useRef<HTMLDivElement>(null);
  const waveformRef = useRef<HTMLCanvasElement>(null);
  const [bodyWidth, setBodyWidth] = useState(0);
  const [hasAudio, setHasAudio] = useState(false);

  const totalMs = Math.max(showEndMs(formations), audioDurationMs(), MIN_TIMELINE_MS);
  const msToPx = useCallback(
    (ms: number): number => (bodyWidth > 0 ? (ms / totalMs) * bodyWidth : 0),
    [bodyWidth, totalMs],
  );

  useEffect(() => {
    const el = bodyRef.current;
    if (el === null) return;
    const observer = new ResizeObserver(() => setBodyWidth(el.clientWidth));
    observer.observe(el);
    setBodyWidth(el.clientWidth);
    return () => observer.disconnect();
  }, []);

  // Waveform: painted once per audio change, sized to the body.
  useEffect(() => {
    setHasAudio(getAudioElement() !== null);
    const canvas = waveformRef.current;
    if (canvas === null || bodyWidth === 0) return;
    canvas.width = bodyWidth;
    const ctx = canvas.getContext('2d');
    if (ctx === null) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (getAudioElement() === null) return;

    let cancelled = false;
    void getWaveformPeaks(WAVEFORM_BINS).then((peaks) => {
      if (cancelled || peaks.length === 0) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = 'rgba(232, 168, 76, 0.45)';
      const mid = canvas.height / 2;
      // Waveform spans only the audio's share of the timeline.
      const audioPx = (audioDurationMs() / totalMs) * canvas.width;
      const binW = audioPx / peaks.length;
      peaks.forEach((peak, i) => {
        const h = Math.max(peak * (canvas.height - 8), 1);
        ctx.fillRect(i * binW, mid - h / 2, Math.max(binW - 0.5, 0.5), h);
      });
    });
    return () => {
      cancelled = true;
    };
  }, [audioVersion, bodyWidth, totalMs]);

  const scrubTo = useCallback(
    (clientX: number): void => {
      const el = bodyRef.current;
      if (el === null) return;
      const rect = el.getBoundingClientRect();
      const ratio = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
      const ms = ratio * totalMs;
      setPlayhead(ms);
      const audio = getAudioElement();
      if (audio !== null) audio.currentTime = ms / 1000;
    },
    [totalMs, setPlayhead],
  );

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>): void => {
    if (e.target instanceof HTMLElement && e.target.dataset['skipScrub'] === 'true') return;
    e.currentTarget.setPointerCapture(e.pointerId);
    scrubTo(e.clientX);
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>): void => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) scrubTo(e.clientX);
  };

  const ordered = byOrder(formations);
  const beatMs = bpm !== null ? 60_000 / bpm : null;
  const eightMarks: number[] = [];
  if (beatMs !== null) {
    for (let t = 0; t <= totalMs; t += beatMs * 8) eightMarks.push(t);
  }

  return (
    <section className="timeline-panel" aria-label="Timeline">
      <div className="timeline-toolbar">
        <button type="button" className="btn" onClick={addFormation}>
          Add formation
        </button>
        <button type="button" className="btn" onClick={onUploadAudio}>
          {hasAudio ? 'Replace audio' : 'Upload audio'}
        </button>
        {hasAudio && (
          <button type="button" className="btn btn-danger" onClick={onClearAudio}>
            Remove audio
          </button>
        )}
        <button
          type="button"
          className="btn"
          title="Drop a beat marker at the playhead (great while music plays)"
          onClick={() => addBeatMarker(useEditor.getState().playheadMs)}
        >
          Tap beat
        </button>
        <span className="mono" style={{ marginLeft: 'auto' }}>
          {isPlaying ? 'playing' : 'click timeline to scrub · click a beat tick to remove it'}
        </span>
      </div>
      <div
        ref={bodyRef}
        className="timeline-body"
        role="slider"
        aria-label="Playhead position"
        aria-valuemin={0}
        aria-valuemax={Math.round(totalMs)}
        aria-valuenow={Math.round(playheadMs)}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onKeyDown={(e) => {
          const step = e.shiftKey ? 5000 : 500;
          if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            e.preventDefault();
            const next = playheadMs + (e.key === 'ArrowRight' ? step : -step);
            const clamped = Math.min(Math.max(next, 0), totalMs);
            setPlayhead(clamped);
            const audio = getAudioElement();
            if (audio !== null) audio.currentTime = clamped / 1000;
          }
        }}
      >
        {/* waveform */}
        <canvas
          ref={waveformRef}
          height={70}
          style={{ position: 'absolute', left: 0, top: 36, width: '100%', height: 70 }}
        />
        {/* 8-count ruler */}
        {eightMarks.map((t, i) => (
          <div
            key={t}
            style={{
              position: 'absolute',
              left: msToPx(t),
              top: 0,
              bottom: 0,
              width: 1,
              background: 'rgba(236, 229, 219, 0.08)',
            }}
          >
            <span
              className="mono"
              style={{ position: 'absolute', top: 2, left: 3, fontSize: 10, opacity: 0.6 }}
            >
              {i + 1}
            </span>
          </div>
        ))}
        {/* beat markers */}
        {beatMarkersMs.map((t) => (
          <button
            key={t}
            type="button"
            data-skip-scrub="true"
            aria-label={`Remove beat marker at ${(t / 1000).toFixed(1)}s`}
            onClick={() => removeBeatMarker(t)}
            style={{
              position: 'absolute',
              left: msToPx(t) - 2,
              top: 30,
              width: 5,
              height: 82,
              padding: 0,
              border: 'none',
              cursor: 'pointer',
              background: 'transparent',
            }}
          >
            <span
              data-skip-scrub="true"
              style={{
                display: 'block',
                width: 1.5,
                height: '100%',
                margin: '0 auto',
                background: '#e8d44c',
                opacity: 0.85,
              }}
            />
          </button>
        ))}
        {/* formation blocks */}
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 8, height: 44 }}>
          {ordered.map((f, i) => {
            const selected = f.id === selectedFormationId;
            const next = ordered[i + 1];
            const holdEnd = f.startTimeMs + f.durationMs;
            return (
              <div key={f.id}>
                <button
                  type="button"
                  data-skip-scrub="true"
                  onClick={() => selectFormation(f.id)}
                  style={{
                    position: 'absolute',
                    left: msToPx(f.startTimeMs),
                    width: Math.max(msToPx(f.durationMs), 34),
                    height: '100%',
                    background: selected ? 'rgba(232, 168, 76, 0.25)' : 'rgba(46, 42, 38, 0.9)',
                    border: `1px solid ${selected ? '#e8a84c' : '#3a322b'}`,
                    borderRadius: 4,
                    color: '#ece5db',
                    fontFamily: "'Instrument Sans Variable', sans-serif",
                    fontSize: 11,
                    cursor: 'pointer',
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                    textOverflow: 'ellipsis',
                    padding: '0 6px',
                  }}
                >
                  {f.name}
                </button>
                {next !== undefined && next.startTimeMs > holdEnd && (
                  <div
                    aria-hidden="true"
                    style={{
                      position: 'absolute',
                      left: msToPx(holdEnd),
                      width: msToPx(next.startTimeMs - holdEnd),
                      top: '50%',
                      borderTop: '1px dashed rgba(154, 143, 130, 0.6)',
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
        {/* playhead */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: msToPx(playheadMs),
            top: 0,
            bottom: 0,
            width: 1.5,
            background: '#e8a84c',
            pointerEvents: 'none',
          }}
        />
      </div>
    </section>
  );
}
