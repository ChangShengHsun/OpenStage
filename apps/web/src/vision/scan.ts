import { assignPointsToPerformers, detectOnstage } from './capture';
import type { ReferenceSpot } from './capture';
import type { Point2 } from './homography';
import { cosineSimilarity, embedPeople, mergeEmbedding } from './reid';

/**
 * M2 — one-click whole-video scan (docs/video-to-formation-killer-app.md):
 * sample the reference video every second, detect people on each sample,
 * chain identities via Hungarian matching, then segment the samples into
 * HELD formations: windows where everyone stands still. Transitions
 * between holds never become formations.
 *
 * Identity through transitions (the part that used to swap dancers):
 * - Each dancer is a track with a VELOCITY; matching runs against the
 *   constant-velocity prediction, not the last spot — two dancers crossing
 *   paths keep their headings instead of trading identities.
 * - When a coarse (1s) step shows movement, the interval is re-scanned at
 *   250ms so nobody moves far enough between samples to be mistaken for a
 *   neighbor. Only coarse samples feed formation segmentation.
 * - Each track carries an APPEARANCE embedding (Re-ID, see reid.ts); the
 *   matching cost adds dissimilarity in meters-equivalent, so dancers in
 *   different outfits cannot trade identities even when their paths do.
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
/** Fine re-scan step through a transition — dancers move ≲0.9m in 250ms,
 *  short enough that nearest-match identity cannot jump to a neighbor. */
const FINE_STEP_MS = 250;
/** Cap on believable dancer speed; anything faster is detector noise. */
const MAX_SPEED_M_S = 3.5;
/** Appearance dissimilarity → meters: cos 0.99 (same look) adds ~0.04m,
 *  cos 0.6 (different outfit) adds ~1.6m — enough to veto a nearby swap. */
const APPEARANCE_WEIGHT_M = 4;

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
  let hold: {
    startMs: number;
    endMs: number;
    sums: Record<string, { x: number; y: number; n: number }>;
    n: number;
  } | null = null;
  let previous: ScanSample | null = null;

  const emit = (): void => {
    const h = hold;
    hold = null;
    if (h === null || h.n < 2) return;
    // Mean over the samples EACH dancer appeared in — dividing by the hold's
    // total sample count dragged partially-detected dancers toward (0,0).
    const positions = Object.fromEntries(
      Object.entries(h.sums).map(([id, p]) => [id, { x: p.x / p.n, y: p.y / p.n }]),
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

function accumulate(
  hold: { sums: Record<string, { x: number; y: number; n: number }>; n: number },
  sample: ScanSample,
): void {
  for (const [id, p] of Object.entries(sample.positions)) {
    const s = hold.sums[id] ?? { x: 0, y: 0, n: 0 };
    hold.sums[id] = { x: s.x + p.x, y: s.y + p.y, n: s.n + 1 };
  }
  hold.n += 1;
}

/** A tracked dancer: last confirmed spot + velocity (m/s) + look. */
export interface TrackedSpot extends ReferenceSpot {
  vx: number;
  vy: number;
  /** EMA appearance embedding; null until the first successful crop. */
  embedding?: Float32Array | null;
}

/**
 * Pure: per-pair appearance cost for the assignment — meters-equivalent
 * dissimilarity, 0 whenever either side has no embedding (matching then
 * falls back to position + velocity alone).
 */
export function appearanceCost(
  tracks: readonly TrackedSpot[],
  embeddings: readonly (Float32Array | null)[],
): (referenceIndex: number, pointIndex: number) => number {
  return (i, j) => {
    const trackEmbedding = tracks[i]?.embedding;
    const pointEmbedding = embeddings[j];
    if (trackEmbedding == null || pointEmbedding == null) return 0;
    return APPEARANCE_WEIGHT_M * (1 - cosineSimilarity(trackEmbedding, pointEmbedding));
  };
}

/**
 * Pure: where each track is EXPECTED to be dtMs later (constant-velocity
 * extrapolation). Matching against the prediction instead of the last spot
 * is what keeps two crossing dancers from trading identities.
 */
export function predictSpots(tracks: readonly TrackedSpot[], dtMs: number): ReferenceSpot[] {
  const dtS = dtMs / 1000;
  return tracks.map((t) => ({
    performerId: t.performerId,
    x: t.x + t.vx * dtS,
    y: t.y + t.vy * dtS,
  }));
}

/**
 * Pure: advance the tracks with this sample's assigned positions. Matched
 * dancers move there and get a new velocity (capped at MAX_SPEED_M_S —
 * faster implies a bad match, and an uncapped velocity would launch the
 * next prediction across the stage). Unmatched dancers KEEP their spot with
 * velocity zeroed — never dropped, or one missed detection would lose the
 * dancer for the rest of the scan.
 */
export function advanceTracks(
  tracks: readonly TrackedSpot[],
  positions: Record<string, Point2>,
  dtMs: number,
  embeddings?: Record<string, Float32Array | null>,
): TrackedSpot[] {
  const dtS = Math.max(dtMs / 1000, 1e-6);
  return tracks.map((t) => {
    const p = positions[t.performerId];
    if (p === undefined) return { ...t, vx: 0, vy: 0 };
    let vx = (p.x - t.x) / dtS;
    let vy = (p.y - t.y) / dtS;
    const speed = Math.hypot(vx, vy);
    if (speed > MAX_SPEED_M_S) {
      vx *= MAX_SPEED_M_S / speed;
      vy *= MAX_SPEED_M_S / speed;
    }
    const e = embeddings?.[t.performerId];
    const embedding = e == null ? (t.embedding ?? null) : mergeEmbedding(t.embedding ?? null, e);
    return { performerId: t.performerId, x: p.x, y: p.y, vx, vy, embedding };
  });
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
 * Identities chain through velocity-predicted Hungarian matching; a coarse
 * step that shows movement triggers a fine (250ms) re-scan of its interval
 * so identities stay locked through transitions. Null = cancelled. The
 * video's playback position is restored afterwards.
 */
export async function scanVideo(
  video: HTMLVideoElement,
  options: ScanOptions,
): Promise<HeldFormation[] | null> {
  const stepMs = options.stepMs ?? 1000;
  const originalTime = video.currentTime;
  const aborted = (): boolean => options.signal?.aborted === true;

  /** Seek + detect + embed; string results are capture errors passed through. */
  const detectAt = async (
    videoMs: number,
  ): Promise<
    { points: Point2[]; embeddings: (Float32Array | null)[] } | 'no-calibration' | 'no-people'
  > => {
    await seekTo(video, videoMs / 1000);
    const detected = await detectOnstage(
      video,
      options.corners,
      options.stageWidth,
      options.stageHeight,
    );
    if (typeof detected === 'string') return detected;
    return {
      points: detected.onstage.map((o) => o.point),
      embeddings: await embedPeople(
        video,
        detected.onstage.map((o) => o.box),
      ),
    };
  };

  /** performerId → this sample's embedding, following the assignment. */
  const embeddingsByPerformer = (
    pointIndexByPerformer: Record<string, number>,
    embeddings: readonly (Float32Array | null)[],
  ): Record<string, Float32Array | null> =>
    Object.fromEntries(
      Object.entries(pointIndexByPerformer).map(([id, j]) => [id, embeddings[j] ?? null]),
    );

  try {
    const durationS = await resolveDuration(video);
    const totalSteps = Math.min(MAX_SAMPLES, Math.floor((durationS * 1000) / stepMs) + 1);
    const samples: ScanSample[] = [];
    let tracks: TrackedSpot[] = options.reference.map((r) => ({ ...r, vx: 0, vy: 0 }));
    let previousPositions: Record<string, Point2> | null = null;
    let previousVideoMs: number | null = null;
    for (let step = 0; step < totalSteps; step++) {
      if (aborted()) return null;
      const videoMs = step * stepMs;
      const timelineMs = videoMs - options.offsetMs;
      if (timelineMs < 0) continue; // inside the lead-in, before timeline 0
      const sample = await detectAt(videoMs);
      options.onProgress?.((step + 1) / totalSteps);
      if (sample === 'no-calibration') return null;
      if (sample === 'no-people') continue; // gap: breaks any hold naturally
      const { points, embeddings } = sample;

      const dtMs = previousVideoMs === null ? stepMs : videoMs - previousVideoMs;
      let assigned = assignPointsToPerformers(
        points,
        predictSpots(tracks, dtMs),
        appearanceCost(tracks, embeddings),
      );
      if (
        previousVideoMs !== null &&
        previousPositions !== null &&
        meanDisplacement(previousPositions, assigned.positions) >= HOLD_THRESHOLD_M
      ) {
        // Movement: re-chain this interval finely so nobody moves far
        // enough between samples to be matched to a neighbor.
        for (
          let fineMs = previousVideoMs + FINE_STEP_MS;
          fineMs < videoMs;
          fineMs += FINE_STEP_MS
        ) {
          if (aborted()) return null;
          const fine = await detectAt(fineMs);
          if (typeof fine === 'string') continue;
          const fineAssigned = assignPointsToPerformers(
            fine.points,
            predictSpots(tracks, FINE_STEP_MS),
            appearanceCost(tracks, fine.embeddings),
          );
          tracks = advanceTracks(
            tracks,
            fineAssigned.positions,
            FINE_STEP_MS,
            embeddingsByPerformer(fineAssigned.pointIndexByPerformer, fine.embeddings),
          );
        }
        // Re-assign the coarse frame's ALREADY-detected points against the
        // refined tracks (no second inference on this frame).
        assigned = assignPointsToPerformers(
          points,
          predictSpots(tracks, FINE_STEP_MS),
          appearanceCost(tracks, embeddings),
        );
        tracks = advanceTracks(
          tracks,
          assigned.positions,
          FINE_STEP_MS,
          embeddingsByPerformer(assigned.pointIndexByPerformer, embeddings),
        );
      } else {
        tracks = advanceTracks(
          tracks,
          assigned.positions,
          dtMs,
          embeddingsByPerformer(assigned.pointIndexByPerformer, embeddings),
        );
      }
      samples.push({ timelineMs, positions: assigned.positions });
      previousPositions = assigned.positions;
      previousVideoMs = videoMs;
    }
    return segmentHeldFormations(samples);
  } finally {
    video.currentTime = originalTime;
  }
}
