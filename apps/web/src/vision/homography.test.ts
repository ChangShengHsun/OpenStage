import { describe, expect, it } from 'vitest';
import { applyHomography, invertHomography, solveHomography } from './homography';
import type { Point2 } from './homography';

const square: Point2[] = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
];

describe('solveHomography', () => {
  it('identity: square onto itself', () => {
    const h = solveHomography(square, square);
    expect(h).not.toBeNull();
    if (h === null) return;
    const p = applyHomography(h, { x: 0.3, y: 0.7 });
    expect(p.x).toBeCloseTo(0.3, 6);
    expect(p.y).toBeCloseTo(0.7, 6);
  });

  it('scale + translation: unit square onto a 12x8m stage at (2,3)', () => {
    const dst: Point2[] = [
      { x: 2, y: 3 },
      { x: 14, y: 3 },
      { x: 14, y: 11 },
      { x: 2, y: 11 },
    ];
    const h = solveHomography(square, dst);
    expect(h).not.toBeNull();
    if (h === null) return;
    const center = applyHomography(h, { x: 0.5, y: 0.5 });
    expect(center.x).toBeCloseTo(8, 6);
    expect(center.y).toBeCloseTo(7, 6);
  });

  it('true perspective: camera-style trapezoid onto the stage rectangle', () => {
    // A stage seen from an elevated audience camera: the upstage edge is
    // shorter on screen than the downstage edge.
    const videoCorners: Point2[] = [
      { x: 420, y: 200 }, // upstage-left
      { x: 860, y: 200 }, // upstage-right
      { x: 1080, y: 620 }, // downstage-right
      { x: 200, y: 620 }, // downstage-left
    ];
    const stageCorners: Point2[] = [
      { x: 0, y: 0 },
      { x: 12, y: 0 },
      { x: 12, y: 8 },
      { x: 0, y: 8 },
    ];
    const h = solveHomography(videoCorners, stageCorners);
    expect(h).not.toBeNull();
    if (h === null) return;
    // All four corners map exactly.
    videoCorners.forEach((corner, i) => {
      const mapped = applyHomography(h, corner);
      expect(mapped.x).toBeCloseTo(stageCorners[i]?.x ?? NaN, 5);
      expect(mapped.y).toBeCloseTo(stageCorners[i]?.y ?? NaN, 5);
    });
    // The screen midpoint of the DOWNSTAGE edge is stage center-x, y=8.
    const downstageMid = applyHomography(h, { x: 640, y: 620 });
    expect(downstageMid.x).toBeCloseTo(6, 4);
    expect(downstageMid.y).toBeCloseTo(8, 4);
    // Perspective is real: the far (upstage) half is compressed into a small
    // band near the top of the frame, so the screen's vertical midpoint has
    // already passed the stage midline — stage y > 4, not exactly 4.
    const screenMiddle = applyHomography(h, { x: 640, y: 410 });
    expect(screenMiddle.y).toBeGreaterThan(4.5);
  });

  it('round-trips through the inverse', () => {
    const videoCorners: Point2[] = [
      { x: 420, y: 200 },
      { x: 860, y: 200 },
      { x: 1080, y: 620 },
      { x: 200, y: 620 },
    ];
    const stageCorners: Point2[] = [
      { x: 0, y: 0 },
      { x: 12, y: 0 },
      { x: 12, y: 8 },
      { x: 0, y: 8 },
    ];
    const h = solveHomography(videoCorners, stageCorners);
    expect(h).not.toBeNull();
    if (h === null) return;
    const inv = invertHomography(h);
    expect(inv).not.toBeNull();
    if (inv === null) return;
    for (const p of [
      { x: 500, y: 300 },
      { x: 700, y: 500 },
      { x: 640, y: 610 },
    ]) {
      const there = applyHomography(h, p);
      const back = applyHomography(inv, there);
      expect(back.x).toBeCloseTo(p.x, 4);
      expect(back.y).toBeCloseTo(p.y, 4);
    }
  });

  it('rejects degenerate input (three collinear corners)', () => {
    const collinear: Point2[] = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 0, y: 1 },
    ];
    expect(solveHomography(collinear, square)).toBeNull();
  });

  it('rejects wrong point counts', () => {
    expect(solveHomography(square.slice(0, 3), square)).toBeNull();
  });
});
