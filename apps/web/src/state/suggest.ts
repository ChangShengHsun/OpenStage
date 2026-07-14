import { planTransition } from '@openstage/path-planner';
import { templateSpots } from './templates';
import type { Spot } from './templates';

/**
 * Rule-based formation suggestions (roadmap V3a). Given the cast, the stage,
 * and where everyone stands in the PREVIOUS formation, propose the top
 * candidate shapes scored by walking distance, spacing quality, and symmetry.
 * Pure functions, no ML, no network — deliberately predictable.
 */

export type SuggestionKind = 'line' | 'v' | 'circle' | 'grid' | 'twoRows' | 'diagonal';

export interface Suggestion {
  kind: SuggestionKind;
  /** One spot per performer, already assigned for minimal total walking. */
  positions: Record<string, Spot>;
  /** 0..1, higher = better. */
  score: number;
}

const MARGIN_M = 1;
const IDEAL_SPACING_M = 1.5;
/** Two dancers closer than this feel crowded — spacing score drops fast. */
const PERSONAL_SPACE_M = 1;
const SYMMETRY_TOLERANCE_M = 0.35;

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

function clampToStage(spots: Spot[], w: number, h: number): Spot[] {
  return spots.map((s) => ({
    x: Math.min(w - MARGIN_M, Math.max(MARGIN_M, s.x)),
    y: Math.min(h - MARGIN_M, Math.max(MARGIN_M, s.y)),
  }));
}

/** Two staggered rows, downstage row slightly wider than the back row. */
function twoRowsSpots(count: number, w: number, h: number): Spot[] {
  const front = Math.ceil(count / 2);
  const back = count - front;
  const usableW = Math.max(w - MARGIN_M * 2, 0.5);
  const rowXs = (n: number, offset: number): number[] => {
    const spacing = n > 1 ? Math.min(IDEAL_SPACING_M, usableW / (n - 1)) : 0;
    const startX = w / 2 - (spacing * (n - 1)) / 2 + offset;
    return Array.from({ length: n }, (_, i) => startX + i * spacing);
  };
  const gap = Math.min(IDEAL_SPACING_M, Math.max(h - MARGIN_M * 2, 1) / 3);
  const frontY = h / 2 + gap / 2;
  const backY = h / 2 - gap / 2;
  // Back row shifts half a spacing so heads peek through the front gaps.
  const spots = [
    ...rowXs(front, 0).map((x) => ({ x, y: frontY })),
    ...rowXs(back, IDEAL_SPACING_M / 2).map((x) => ({ x, y: backY })),
  ];
  return clampToStage(spots, w, h);
}

/** A diagonal from upstage-left to downstage-right. */
function diagonalSpots(count: number, w: number, h: number): Spot[] {
  if (count === 1) return [{ x: w / 2, y: h / 2 }];
  const spots = Array.from({ length: count }, (_, i) => {
    const t = i / (count - 1);
    return {
      x: MARGIN_M + t * (w - MARGIN_M * 2),
      y: MARGIN_M + t * (h - MARGIN_M * 2),
    };
  });
  return clampToStage(spots, w, h);
}

function candidateSpots(kind: SuggestionKind, count: number, w: number, h: number): Spot[] {
  if (kind === 'twoRows') return twoRowsSpots(count, w, h);
  if (kind === 'diagonal') return diagonalSpots(count, w, h);
  return templateSpots(kind, count, w, h);
}

/** Nearest-neighbor spacing quality: crowding and unevenness both hurt. */
export function scoreSpacing(spots: readonly Spot[]): number {
  if (spots.length < 2) return 1;
  const nearest = spots.map((a, i) =>
    Math.min(...spots.filter((_, j) => j !== i).map((b) => Math.hypot(a.x - b.x, a.y - b.y))),
  );
  const mean = nearest.reduce((s, d) => s + d, 0) / nearest.length;
  if (mean === 0) return 0;
  const std = Math.sqrt(nearest.reduce((s, d) => s + (d - mean) ** 2, 0) / nearest.length);
  const crowding = clamp01(Math.min(...nearest) / PERSONAL_SPACE_M);
  const uniformity = clamp01(1 - std / mean);
  // Crowding gates the whole score: an evenly OVERLAPPING clump is still bad.
  return crowding * (0.6 + 0.4 * uniformity);
}

/** Fraction of spots that have a left-right mirror partner. */
export function scoreSymmetry(spots: readonly Spot[], stageWidth: number): number {
  if (spots.length === 0) return 0;
  let mirrored = 0;
  for (const spot of spots) {
    const mx = stageWidth - spot.x;
    const hasPartner = spots.some(
      (other) =>
        Math.abs(other.x - mx) < SYMMETRY_TOLERANCE_M &&
        Math.abs(other.y - spot.y) < SYMMETRY_TOLERANCE_M,
    );
    if (hasPartner) mirrored += 1;
  }
  return mirrored / spots.length;
}

/**
 * Suggest up to `limit` formations, best first, one per shape family.
 * `previousPositions` (the formation being walked FROM) drives both the
 * travel score and the who-takes-which-spot assignment; pass null for the
 * first formation of a show.
 */
export function suggestFormations(
  performerIds: readonly string[],
  previousPositions: Readonly<Record<string, Spot>> | null,
  stageWidth: number,
  stageHeight: number,
  limit = 3,
): Suggestion[] {
  const count = performerIds.length;
  if (count === 0) return [];

  const prevSpots =
    previousPositions !== null && performerIds.every((id) => previousPositions[id] !== undefined)
      ? performerIds.map((id) => previousPositions[id] as Spot)
      : null;
  // Half the stage diagonal ~ a long walk; anything beyond scores 0.
  const walkRef = Math.hypot(stageWidth, stageHeight) / 2;

  const kinds: readonly SuggestionKind[] = ['line', 'v', 'circle', 'grid', 'twoRows', 'diagonal'];
  const suggestions = kinds.map((kind) => {
    const spots = candidateSpots(kind, count, stageWidth, stageHeight);

    let assignment = spots.map((_, i) => i);
    let travelScore = 0.5; // neutral when there is nothing to walk from
    if (prevSpots !== null) {
      const plan = planTransition(prevSpots, spots);
      assignment = plan.assignment;
      travelScore = clamp01(1 - plan.totalDistance / (count * walkRef));
    }

    const positions: Record<string, Spot> = {};
    performerIds.forEach((id, i) => {
      const spot = spots[assignment[i] ?? i];
      if (spot !== undefined) positions[id] = spot;
    });

    const score =
      travelScore * 0.45 + scoreSpacing(spots) * 0.3 + scoreSymmetry(spots, stageWidth) * 0.25;
    return { kind, positions, score };
  });

  return suggestions.sort((a, b) => b.score - a.score).slice(0, limit);
}
