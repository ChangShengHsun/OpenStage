/**
 * Pure geometry for the formation-editing tools (mirror / align / distribute /
 * swap). Each takes and returns plain spots so it is unit-testable without the
 * store; the store actions map a formation's positions through these.
 */

export interface Spot {
  id: string;
  x: number;
  y: number;
  rotation: number;
}

const normalizeDeg = (deg: number): number => ((deg % 360) + 360) % 360;
const mean = (xs: readonly number[]): number =>
  xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;

/**
 * Mirror across the vertical center line (x' = width − x). Facing reflects
 * too: reflecting the heading vector's x-component works out to rotation →
 * −rotation (0 stays facing the audience, a stage-right lean becomes
 * stage-left).
 */
export function mirrorAcrossX(spots: readonly Spot[], stageWidth: number): Spot[] {
  return spots.map((s) => ({
    ...s,
    x: stageWidth - s.x,
    rotation: normalizeDeg(-s.rotation),
  }));
}

/** Align onto a shared line: 'row' → common y (a straight row), 'col' → common x. */
export function alignSpots(spots: readonly Spot[], axis: 'row' | 'col'): Spot[] {
  if (axis === 'row') {
    const y = mean(spots.map((s) => s.y));
    return spots.map((s) => ({ ...s, y }));
  }
  const x = mean(spots.map((s) => s.x));
  return spots.map((s) => ({ ...s, x }));
}

/**
 * Space spots evenly between the two extremes along one axis. The endpoints
 * stay put; the ones between are redistributed. Needs 3+ to do anything.
 */
export function distributeSpots(spots: readonly Spot[], axis: 'x' | 'y'): Spot[] {
  if (spots.length < 3) return [...spots];
  const sorted = [...spots].sort((a, b) => a[axis] - b[axis]);
  const lo = sorted[0]?.[axis] ?? 0;
  const hi = sorted[sorted.length - 1]?.[axis] ?? 0;
  const step = (hi - lo) / (sorted.length - 1);
  return sorted.map((s, i) => ({ ...s, [axis]: lo + step * i }));
}

/** Swap the placement (position + facing) of exactly two spots. */
export function swapSpots(a: Spot, b: Spot): { a: Spot; b: Spot } {
  return {
    a: { ...a, x: b.x, y: b.y, rotation: b.rotation },
    b: { ...b, x: a.x, y: a.y, rotation: a.rotation },
  };
}
