import { useEditor } from '../state/store';
import { formatEightCount, formatTimecode, posesAtTime, showEndMs } from '../state/interpolate';
import { safeFilename } from './filename';
import { messages } from '../i18n';
import type { Messages } from '../i18n';
import { recordCanvas } from './videoRecorder';
import type { SceneDoc } from './stage3dRenderer';

// 720p — plenty for sharing a formation preview in a group chat.
const W = 1280;
const H = 720;

const BG = '#191512';
const FLOOR = '#2e2a26';
const INK = '#ece5db';
const DIM = '#8a8074';
const EDGE = '#e8a84c';
const SANS = '"Instrument Sans", system-ui, sans-serif';
const MONO = '"IBM Plex Mono", monospace';

export type VideoMode = '2d' | '3d';

export interface VideoExportOptions {
  /** '2d' = top-down plan, '3d' = the perspective preview. */
  mode: VideoMode;
  onProgress: (fraction: number) => void;
  signal?: AbortSignal;
}

/**
 * Records the playback animation to a movie file and triggers a download.
 * The 2D plan is drawn here on a canvas; the 3D view renders through a
 * dynamically-imported three renderer so its ~900KB only loads for 3D.
 * The uploaded music is mixed into the file (silently). Document state is
 * snapshotted once at the start, so edits during the export don't leak in.
 *
 * ponytail: realtime capture — the export takes as long as the show and the
 * tab must stay visible. Upgrade path: WebCodecs VideoEncoder + an mp4 muxer.
 */
export async function exportPerformanceVideo({
  mode,
  onProgress,
  signal,
}: VideoExportOptions): Promise<void> {
  const s = useEditor.getState();
  const msg = messages();
  const durationMs = showEndMs(s.formations);
  if (durationMs <= 0) throw new Error(msg.videoExport.errNothingToExport);

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  // Chrome only delivers captureStream frames reliably for in-document canvases.
  canvas.style.cssText = 'position:fixed;left:-99999px;top:0';
  document.body.appendChild(canvas);

  const doc: SceneDoc = {
    performance: s.performance,
    performers: s.performers,
    formations: s.formations,
    positions: s.positions,
  };

  let dispose: (() => void) | null = null;
  try {
    let renderFrame: (tMs: number) => void;
    if (mode === '3d') {
      const { buildStage3dRenderer } = await import('./stage3dRenderer');
      const renderer = buildStage3dRenderer(canvas, doc);
      renderFrame = renderer.renderFrame;
      dispose = renderer.dispose;
    } else {
      renderFrame = build2dRenderer(canvas, doc, msg);
    }

    const result = await recordCanvas({ canvas, durationMs, renderFrame, onProgress, signal });
    if (result === null) return; // aborted

    const url = URL.createObjectURL(result.blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    const suffix = mode === '3d' ? '3d' : 'preview';
    anchor.download = `${safeFilename(s.performance.title)}-${suffix}.${result.ext}`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  } finally {
    dispose?.();
    canvas.remove();
  }
}

/** Top-down plan renderer: closes over the layout, returns a per-frame draw. */
function build2dRenderer(
  canvas: HTMLCanvasElement,
  doc: SceneDoc,
  msg: Messages,
): (tMs: number) => void {
  const ctx = canvas.getContext('2d');
  if (ctx === null) throw new Error('Canvas 2D unavailable');

  const { stageWidth, stageHeight, title, bpm } = doc.performance;
  const headerH = 72;
  const footerH = 56;
  const sideM = 72;
  const scale = Math.min((W - sideM * 2) / stageWidth, (H - headerH - footerH) / stageHeight);
  const stageW = stageWidth * scale;
  const stageH = stageHeight * scale;
  const originX = (W - stageW) / 2;
  const originY = headerH + (H - headerH - footerH - stageH) / 2;
  const markR = Math.max(0.3 * scale, 7);

  return (tMs: number): void => {
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);

    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = INK;
    ctx.font = `600 26px ${SANS}`;
    ctx.textAlign = 'left';
    ctx.fillText(title, sideM, 46);
    ctx.fillStyle = DIM;
    ctx.font = `16px ${MONO}`;
    ctx.textAlign = 'right';
    const eightCount =
      bpm !== null ? formatEightCount(tMs, bpm, doc.performance.countSegments) : null;
    const counts = eightCount !== null ? `  ${eightCount}` : '';
    ctx.fillText(`${formatTimecode(tMs)}${counts}`, W - sideM, 46);

    ctx.fillStyle = FLOOR;
    ctx.fillRect(originX, originY, stageW, stageH);
    ctx.strokeStyle = DIM;
    ctx.lineWidth = 1;
    ctx.strokeRect(originX, originY, stageW, stageH);

    ctx.save();
    ctx.setLineDash([6, 6]);
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    ctx.moveTo(originX + stageW / 2, originY);
    ctx.lineTo(originX + stageW / 2, originY + stageH);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = EDGE;
    ctx.fillRect(originX, originY + stageH + 4, stageW, 3);
    ctx.fillStyle = DIM;
    ctx.font = `13px ${SANS}`;
    ctx.textAlign = 'center';
    ctx.fillText(msg.stage.audience, W / 2, originY + stageH + 28);

    const poses = posesAtTime(doc.formations, doc.positions, tMs);
    for (const performer of doc.performers) {
      const pose = poses.get(performer.id);
      if (pose === undefined) continue;
      const x = originX + pose.x * scale;
      const y = originY + pose.y * scale;
      // rotation 0 = facing the audience (downstage, +y on the plan).
      const angleRad = ((pose.rotation + 90) * Math.PI) / 180;

      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(angleRad) * markR * 1.7, y + Math.sin(angleRad) * markR * 1.7);
      ctx.stroke();

      ctx.fillStyle = performer.color;
      ctx.beginPath();
      ctx.arc(x, y, markR, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = INK;
      ctx.font = `12px ${SANS}`;
      ctx.textAlign = 'center';
      ctx.fillText(performer.name, x, y + markR + 16);
    }
  };
}
