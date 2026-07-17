import { captureAtTime } from './capture';
import type { ReferenceSpot } from './capture';
import type { Point2 } from './homography';

/**
 * M2 — one-click whole-video scan (docs/video-to-formation-killer-app.md):
 * sample the reference video every second, run the M0 capture on each
 * sample (identity chained through Hungarian against the previous sample),
 * then segment the samples into HELD formations: windows where everyone
 * stands still. Transitions between holds never become formations.
 */

export interface ScanSample {
  /** Shared-timeline time of this sample (ms, offset already applied). */
  timelineMs: number;
  positions: Record<string, Point2>;
}

export interface HeldFormation {
  startTimeMs: number;
  endTimeMs: number;
  positions: Record<string, Point2>;
}

/** Everyone moved less than this between samples = still standing (m). */
const HOLD_THRESHOLD_M = 0.4;
/** A new hold closer than this to the previous one is the same formation. */
const CHANGE_THRESHOLD_M = 0.8;
/** Guard rail: 1s sampling for up to 20 minutes of video. */
const MAX_SAMPLES = 1200;

/** Mean per-dancer distance between two sampled position maps; Infinity
 *  when they share no dancers (a gap breaks any hold). */
export function meanDisplacement(a: Record<string, Point2>, b: Record<string, Point2>): number {
  let sum = 0;
  let count = 0;
  for (const [id, pa] of Object.entries(a)) {
    const pb = b[id];
    if (pb === undefined) continue;
    sum += Math.hypot(pa.x - pb.x, pa.y - pb.y);
    count += 1;
  }
  return count === 0 ? Number.POSITIVE_INFINITY : sum / count;
}

/**
 * Pure: samples → held formations. A hold needs at least two consecutive
 * stable samples (a single frame mid-transition can look like anything);
 * position output is the per-dancer mean over the hold (averages out
 * detection jitter). Consecutive holds that barely differ are merged.
 */
export function segmentHeldFormations(samples: readonly ScanSample[]): HeldFormation[] {
  const held: HeldFormation[] = [];
  let hold: { startMs: number; endMs: number; sums: Record<string, Point2>; n: number } | null =
    null;
  let previous: ScanSample | null = null;

  const emit = (): void => {
    const h = hold;
    hold = null;
    if (h === null || h.n < 2) return;
    const positions = Object.fromEntries(
      Object.entries(h.sums).map(([id, p]) => [id, { x: p.x / h.n, y: p.y / h.n }]),
    );
    const last = held[held.length - 1];
    if (last !== undefined && meanDisplacement(last.positions, positions) < CHANGE_THRESHOLD_M) {
      // Same formation wobbling — extend it instead of duplicating.
      last.endTimeMs = h.endMs;
    } else {
      held.push({ startTimeMs: h.startMs, endTimeMs: h.endMs, positions });
    }
  };

  for (const sample of samples) {
    if (
      previous !== null &&
      meanDisplacement(previous.positions, sample.positions) < HOLD_THRESHOLD_M
    ) {
      if (hold === null) {
        // The PREVIOUS sample was the first still one.
        hold = { startMs: previous.timelineMs, endMs: previous.timelineMs, sums: {}, n: 0 };
        accumulate(hold, previous);
      }
      accumulate(hold, sample);
      hold.endMs = sample.timelineMs;
    } else {
      emit();
    }
    previous = sample;
  }
  emit();
  return held;
}

function accumulate(hold: { sums: Record<string, Point2>; n: number }, sample: ScanSample): void {
  for (const [id, p] of Object.entries(sample.positions)) {
    const s = hold.sums[id] ?? { x: 0, y: 0 };
    hold.sums[id] = { x: s.x + p.x, y: s.y + p.y };
  }
  hold.n += 1;
}

/** Seek and resolve when the frame is actually presented. */
function seekTo(video: HTMLVideoElement, seconds: number): Promise<void> {
  return new Promise((resolve) => {
    const done = (): void => {
      video.removeEventListener('seeked', done);
      resolve();
    };
    video.addEventListener('seeked', done);
    video.currentTime = seconds;
  });
}

/**
 * MediaRecorder-produced webm files report duration = Infinity untilForced;
 * the standard workaround is seeking far past the end once.
 */
async function resolveDuration(video: HTMLVideoElement): Promise<number> {
  if (Number.isFinite(video.duration)) return video.duration;
  await seekTo(video, 1e7);
  return Number.isFinite(video.duration) ? video.duration : video.currentTime;
}

export interface ScanOptions {
  stepMs?: number;
  offsetMs: number;
  stageWidth: number;
  stageHeight: number;
  corners: readonly Point2[];
  /** Starting identities — the selected formation's current spots. */
  reference: readonly ReferenceSpot[];
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
}

/**
 * Sample the whole video and return the held formations (timeline ms).
 * Identity chains: each sample's Hungarian reference is the previous
 * sample's result, so identities follow the dancers through the piece.
 * Null = cancelled. The video's playback position is restored afterwards.
 */
export async function scanVideo(
  video: HTMLVideoElement,
  options: ScanOptions,
): Promise<HeldFormation[] | null> {
  const stepMs = options.stepMs ?? 1000;
  const originalTime = video.currentTime;
  try {
    const durationS = await resolveDuration(video);
    const totalSteps = Math.min(MAX_SAMPLES, Math.floor((durationS * 1000) / stepMs) + 1);
    const samples: ScanSample[] = [];
    let reference = options.reference;
    for (let step = 0; step < totalSteps; step++) {
      if (options.signal?.aborted === true) return null;
      const videoMs = step * stepMs;
      const timelineMs = videoMs - options.offsetMs;
      if (timelineMs < 0) continue; // inside the lead-in, before timeline 0
      await seekTo(video, videoMs / 1000);
      const result = await captureAtTime(
        video,
        options.corners,
        options.stageWidth,
        options.stageHeight,
        reference,
      );
      options.onProgress?.((step + 1) / totalSteps);
      if (result === 'no-calibration') return null;
      if (result === 'no-people') continue; // gap: breaks any hold naturally
      samples.push({ timelineMs, positions: result.positions });
      // Chain identities through the piece.
      reference = Object.entries(result.positions).map(([performerId, p]) => ({
        performerId,
        x: p.x,
        y: p.y,
      }));
    }
    return segmentHeldFormations(samples);
  } finally {
    video.currentTime = originalTime;
  }
}
