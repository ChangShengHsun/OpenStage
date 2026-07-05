import type { Formation } from '@openstage/shared-types';

/**
 * Set one formation's start time (clamped ≥ 0) and re-derive every
 * formation's orderIndex from start-time order.
 *
 * Playback (`posesAtTime`) walks formations by orderIndex, so the invariant
 * "orderIndex order === start-time order" must hold. Dragging a formation
 * past another on the timeline therefore reorders them — the intuitive result.
 * Ties keep their previous relative order.
 */
export function reindexByStart(
  formations: readonly Formation[],
  changedId: string,
  newStartMs: number,
): Formation[] {
  const clamped = Math.max(0, Math.round(newStartMs));
  return [...formations]
    .map((f) => (f.id === changedId ? { ...f, startTimeMs: clamped } : f))
    .sort((a, b) => a.startTimeMs - b.startTimeMs || a.orderIndex - b.orderIndex)
    .map((f, i) => ({ ...f, orderIndex: i }));
}
