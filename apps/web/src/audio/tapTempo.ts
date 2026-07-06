/**
 * Tap-tempo BPM calibration: the user clicks once per beat (starting on a
 * downbeat) and the tempo is measured from the click timestamps.
 */

/** A pause longer than this between taps starts a fresh calibration run. */
export const TAP_RESET_MS = 3000;

/** Taps needed before the estimate is stable enough to offer applying. */
export const MIN_TAPS_TO_APPLY = 4;

/**
 * BPM from tap timestamps (ms). Uses total span / interval count, so
 * per-tap jitter averages out instead of accumulating. Null until two taps.
 */
export function bpmFromTaps(taps: readonly number[]): number | null {
  const first = taps[0];
  const last = taps[taps.length - 1];
  if (first === undefined || last === undefined || taps.length < 2 || last <= first) return null;
  return (60_000 * (taps.length - 1)) / (last - first);
}

/** Append a tap, restarting the run if the user paused too long. */
export function appendTap(taps: readonly number[], nowMs: number): number[] {
  const last = taps[taps.length - 1];
  if (last !== undefined && nowMs - last > TAP_RESET_MS) return [nowMs];
  return [...taps, nowMs];
}
