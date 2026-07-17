/**
 * 4-point planar homography (docs/video-to-formation-killer-app.md, M0):
 * maps the stage floor as seen in a video frame (pixels) onto the top-down
 * stage plan (meters). Solved with the Direct Linear Transform — for exactly
 * four correspondences the 8 unknowns of H (h33 = 1) satisfy an 8×8 linear
 * system, solved here by Gaussian elimination with partial pivoting.
 * Pure math, no dependencies.
 */

export interface Point2 {
  x: number;
  y: number;
}

/** Row-major 3×3 matrix with h33 fixed to 1 — 9 numbers. */
export type Homography = readonly number[];

/**
 * Solve H such that dst ~ H · src for the four given correspondences.
 * Returns null when the system is degenerate (e.g. three collinear corners),
 * which the calibration UI reports as "re-place your pins".
 */
export function solveHomography(
  src: readonly Point2[],
  dst: readonly Point2[],
): Homography | null {
  if (src.length !== 4 || dst.length !== 4) return null;
  // Build the 8×8 system A·h = b for h = [h11 h12 h13 h21 h22 h23 h31 h32].
  const a: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const s = src[i];
    const d = dst[i];
    if (s === undefined || d === undefined) return null;
    a.push([s.x, s.y, 1, 0, 0, 0, -s.x * d.x, -s.y * d.x]);
    b.push(d.x);
    a.push([0, 0, 0, s.x, s.y, 1, -s.x * d.y, -s.y * d.y]);
    b.push(d.y);
  }
  const h = solveLinearSystem(a, b);
  if (h === null) return null;
  return [...h, 1];
}

/** Apply H to a point (perspective divide included). */
export function applyHomography(h: Homography, p: Point2): Point2 {
  const w = (h[6] ?? 0) * p.x + (h[7] ?? 0) * p.y + (h[8] ?? 1);
  return {
    x: ((h[0] ?? 0) * p.x + (h[1] ?? 0) * p.y + (h[2] ?? 0)) / w,
    y: ((h[3] ?? 0) * p.x + (h[4] ?? 0) * p.y + (h[5] ?? 0)) / w,
  };
}

/** Invert H (3×3, adjugate method) — used to draw the meter grid back onto
 *  the video frame so the user can SEE calibration quality. */
export function invertHomography(h: Homography): Homography | null {
  const [a, b, c, d, e, f, g, i, j] = [
    h[0] ?? 0,
    h[1] ?? 0,
    h[2] ?? 0,
    h[3] ?? 0,
    h[4] ?? 0,
    h[5] ?? 0,
    h[6] ?? 0,
    h[7] ?? 0,
    h[8] ?? 1,
  ];
  const A = e * j - f * i;
  const B = -(d * j - f * g);
  const C = d * i - e * g;
  const det = a * A + b * B + c * C;
  if (!Number.isFinite(det) || Math.abs(det) < 1e-12) return null;
  const inv = [
    A / det,
    -(b * j - c * i) / det,
    (b * f - c * e) / det,
    B / det,
    (a * j - c * g) / det,
    -(a * f - c * d) / det,
    C / det,
    -(a * i - b * g) / det,
    (a * e - b * d) / det,
  ];
  // Normalize so the last element is 1 (Homography convention here).
  const scale = inv[8] ?? 1;
  if (Math.abs(scale) < 1e-12) return null;
  return inv.map((v) => v / scale);
}

/** Normalize degrees into [0, 360) — the stage rotation convention. */
export function normalizeStageRotation(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/** Gaussian elimination with partial pivoting; null when singular. */
function solveLinearSystem(a: number[][], b: number[]): number[] | null {
  const n = b.length;
  // Augmented matrix.
  const m = a.map((row, rowIndex) => [...row, b[rowIndex] ?? 0]);
  for (let col = 0; col < n; col++) {
    // Pivot: largest magnitude in this column, at or below the diagonal.
    let pivotRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(m[row]?.[col] ?? 0) > Math.abs(m[pivotRow]?.[col] ?? 0)) pivotRow = row;
    }
    const pivotVal = m[pivotRow]?.[col] ?? 0;
    if (Math.abs(pivotVal) < 1e-10) return null; // singular / degenerate
    if (pivotRow !== col) {
      const tmp = m[col];
      const other = m[pivotRow];
      if (tmp === undefined || other === undefined) return null;
      m[col] = other;
      m[pivotRow] = tmp;
    }
    const pivot = m[col];
    if (pivot === undefined) return null;
    for (let row = col + 1; row < n; row++) {
      const target = m[row];
      if (target === undefined) continue;
      const factor = (target[col] ?? 0) / (pivot[col] ?? 1);
      for (let k = col; k <= n; k++) {
        target[k] = (target[k] ?? 0) - factor * (pivot[k] ?? 0);
      }
    }
  }
  // Back substitution.
  const x = new Array<number>(n).fill(0);
  for (let row = n - 1; row >= 0; row--) {
    const r = m[row];
    if (r === undefined) return null;
    let sum = r[n] ?? 0;
    for (let k = row + 1; k < n; k++) sum -= (r[k] ?? 0) * (x[k] ?? 0);
    x[row] = sum / (r[row] ?? 1);
  }
  return x;
}
