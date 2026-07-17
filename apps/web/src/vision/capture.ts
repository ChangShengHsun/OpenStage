import { hungarian } from '@gridstage/path-planner';
import { detectPeople, footPoint } from './detector';
import { applyHomography, solveHomography } from './homography';
import type { Point2 } from './homography';

/**
 * One-click "capture this frame" (M0 of
 * docs/video-to-formation-killer-app.md): paused video frame → person boxes
 * → foot points → homography → stage meters → identity via Hungarian
 * matching against where everyone currently stands. `captureAtTime` is the
 * reusable core M2 will loop over the whole video at 1s steps.
 */

/** How far outside the stage rect a foot point may fall and still count —
 *  wings exist, and calibration is never pixel-perfect. */
const OFFSTAGE_MARGIN_M = 1.5;
/** Assignment is "uncertain" when another detected point is nearly as close
 *  to this dancer's previous spot as the chosen one. */
const AMBIGUITY_MARGIN_M = 0.7;
/** Padding cost for the square matrix — far above any real stage distance. */
const PAD_COST = 1e6;

export interface CaptureAssignment {
  /** performerId → captured stage position (meters). */
  positions: Record<string, Point2>;
  /** Performers whose assignment had a near-tie — the UI selects these. */
  uncertainIds: string[];
  /** Raw usable detections (after the offstage filter). */
  detectedCount: number;
}

export interface ReferenceSpot {
  performerId: string;
  x: number;
  y: number;
}

/**
 * Pure: match detected stage points to performers by minimizing total
 * distance from their current (reference) spots. Extra detections are
 * dropped; missing detections leave those performers untouched.
 */
export function assignPointsToPerformers(
  points: readonly Point2[],
  reference: readonly ReferenceSpot[],
): CaptureAssignment {
  const n = Math.max(points.length, reference.length);
  if (n === 0) return { positions: {}, uncertainIds: [], detectedCount: points.length };
  // Square cost matrix: rows = performers, columns = points, padded.
  const cost: number[][] = [];
  for (let i = 0; i < n; i++) {
    const row: number[] = [];
    const ref = reference[i];
    for (let j = 0; j < n; j++) {
      const pt = points[j];
      row.push(
        ref === undefined || pt === undefined ? PAD_COST : Math.hypot(ref.x - pt.x, ref.y - pt.y),
      );
    }
    cost.push(row);
  }
  const assignment = hungarian(cost);
  const positions: Record<string, Point2> = {};
  const uncertainIds: string[] = [];
  reference.forEach((ref, i) => {
    const j = assignment[i] ?? -1;
    const pt = j >= 0 ? points[j] : undefined;
    if (pt === undefined) return; // padded column: this performer keeps their spot
    positions[ref.performerId] = { x: pt.x, y: pt.y };
    const chosen = cost[i]?.[j] ?? 0;
    const nearTie = points.some(
      (other, k) =>
        k !== j && Math.hypot(ref.x - other.x, ref.y - other.y) - chosen < AMBIGUITY_MARGIN_M,
    );
    if (nearTie) uncertainIds.push(ref.performerId);
  });
  return { positions, uncertainIds, detectedCount: points.length };
}

export type CaptureError = 'no-calibration' | 'no-people';

/**
 * Detect people on the video's CURRENT frame and place them on the stage.
 * `corners` are the calibration pins (video-intrinsic px, upstage-left,
 * upstage-right, downstage-right, downstage-left).
 */
export async function captureAtTime(
  video: HTMLVideoElement,
  corners: readonly Point2[],
  stageWidth: number,
  stageHeight: number,
  reference: readonly ReferenceSpot[],
): Promise<CaptureAssignment | CaptureError> {
  const h = solveHomography(corners, [
    { x: 0, y: 0 },
    { x: stageWidth, y: 0 },
    { x: stageWidth, y: stageHeight },
    { x: 0, y: stageHeight },
  ]);
  if (h === null) return 'no-calibration';
  const boxes = await detectPeople(video, video.videoWidth, video.videoHeight);
  const points = boxes
    .map((box) => applyHomography(h, footPoint(box)))
    .filter(
      (p) =>
        p.x > -OFFSTAGE_MARGIN_M &&
        p.x < stageWidth + OFFSTAGE_MARGIN_M &&
        p.y > -OFFSTAGE_MARGIN_M &&
        p.y < stageHeight + OFFSTAGE_MARGIN_M,
    );
  if (points.length === 0) return 'no-people';
  return assignPointsToPerformers(points, reference);
}
