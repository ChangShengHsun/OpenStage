import { describe, expect, it } from 'vitest';
import {
  advanceTracks,
  appearanceCost,
  meanDisplacement,
  predictSpots,
  segmentHeldFormations,
} from './scan';
import type { ScanSample, TrackedSpot } from './scan';
import { assignPointsToPerformers } from './capture';
import { cosineSimilarity, mergeEmbedding } from './reid';

const sample = (timelineMs: number, spots: Record<string, [number, number]>): ScanSample => ({
  timelineMs,
  positions: Object.fromEntries(Object.entries(spots).map(([id, [x, y]]) => [id, { x, y }])),
});

describe('meanDisplacement', () => {
  it('averages distances over shared dancers', () => {
    const d = meanDisplacement(
      { a: { x: 0, y: 0 }, b: { x: 10, y: 0 } },
      { a: { x: 3, y: 4 }, b: { x: 10, y: 0 } },
    );
    expect(d).toBeCloseTo(2.5); // (5 + 0) / 2
  });

  it('is Infinity with no shared dancers', () => {
    expect(meanDisplacement({ a: { x: 0, y: 0 } }, { b: { x: 0, y: 0 } })).toBe(
      Number.POSITIVE_INFINITY,
    );
  });
});

describe('segmentHeldFormations', () => {
  it('finds two holds separated by a transition', () => {
    const samples = [
      // Hold A: 0–2s at (2,3)/(10,5)
      sample(0, { a: [2, 3], b: [10, 5] }),
      sample(1000, { a: [2.1, 3], b: [10, 5.1] }),
      sample(2000, { a: [2, 3.1], b: [9.9, 5] }),
      // Transition: everyone moving
      sample(3000, { a: [4, 4], b: [8, 5.5] }),
      sample(4000, { a: [6, 5], b: [6, 6] }),
      // Hold B: 5–7s at (8,6)/(4,6.5)
      sample(5000, { a: [8, 6], b: [4, 6.5] }),
      sample(6000, { a: [8.1, 6], b: [4, 6.4] }),
      sample(7000, { a: [8, 6.1], b: [3.9, 6.5] }),
    ];
    const held = segmentHeldFormations(samples);
    expect(held).toHaveLength(2);
    expect(held[0]?.startTimeMs).toBe(0);
    expect(held[0]?.endTimeMs).toBe(2000);
    // Positions are the mean over the hold — near the nominal spot.
    expect(held[0]?.positions['a']?.x ?? NaN).toBeCloseTo(2.03, 1);
    expect(held[1]?.startTimeMs).toBe(5000);
    expect(held[1]?.positions['a']?.x ?? NaN).toBeCloseTo(8.03, 1);
  });

  it('never emits a single-sample "hold" (mid-transition snapshots)', () => {
    const held = segmentHeldFormations([
      sample(0, { a: [1, 1] }),
      sample(1000, { a: [4, 4] }),
      sample(2000, { a: [8, 8] }),
    ]);
    expect(held).toHaveLength(0);
  });

  it('merges a wobble back into the same formation', () => {
    const held = segmentHeldFormations([
      sample(0, { a: [5, 5] }),
      sample(1000, { a: [5.1, 5] }),
      // One jittery sample (detector noise), then still again at the SAME spot.
      sample(2000, { a: [5.8, 5.6] }),
      sample(3000, { a: [5.05, 5.02] }),
      sample(4000, { a: [5.1, 5.05] }),
    ]);
    expect(held).toHaveLength(1);
    expect(held[0]?.endTimeMs).toBe(4000);
  });

  it('handles the empty input', () => {
    expect(segmentHeldFormations([])).toEqual([]);
  });

  it('averages a partially-detected dancer over their OWN samples only', () => {
    // Dancer b is missed in one of three samples: their mean must stay at
    // (8, 6), not be dragged toward the origin by a phantom zero sample.
    const held = segmentHeldFormations([
      sample(0, { a: [2, 3], b: [8, 6] }),
      sample(1000, { a: [2, 3] }),
      sample(2000, { a: [2, 3], b: [8, 6] }),
    ]);
    expect(held).toHaveLength(1);
    expect(held[0]?.positions['b']?.x ?? NaN).toBeCloseTo(8);
    expect(held[0]?.positions['b']?.y ?? NaN).toBeCloseTo(6);
  });
});

describe('advanceTracks', () => {
  it('moves matched dancers and derives their velocity', () => {
    const tracks: TrackedSpot[] = [{ performerId: 'a', x: 1, y: 1, vx: 0, vy: 0 }];
    const next = advanceTracks(tracks, { a: { x: 3, y: 1 } }, 1000);
    expect(next[0]).toEqual({ performerId: 'a', x: 3, y: 1, vx: 2, vy: 0, embedding: null });
  });

  it('keeps unmatched performers (velocity zeroed) instead of dropping them', () => {
    const tracks: TrackedSpot[] = [
      { performerId: 'a', x: 1, y: 1, vx: 0, vy: 0 },
      { performerId: 'b', x: 5, y: 5, vx: 1, vy: 1 },
    ];
    const next = advanceTracks(tracks, { a: { x: 2, y: 2 } }, 1000);
    expect(next).toHaveLength(2);
    expect(next[1]).toEqual({ performerId: 'b', x: 5, y: 5, vx: 0, vy: 0 });
  });

  it('caps an implausible speed (teleporting detection noise)', () => {
    const tracks: TrackedSpot[] = [{ performerId: 'a', x: 0, y: 0, vx: 0, vy: 0 }];
    const next = advanceTracks(tracks, { a: { x: 10, y: 0 } }, 1000); // 10 m/s
    expect(Math.hypot(next[0]?.vx ?? 0, next[0]?.vy ?? 0)).toBeCloseTo(3.5);
  });
});

describe('predictSpots', () => {
  it('extrapolates each track by its velocity', () => {
    const tracks: TrackedSpot[] = [{ performerId: 'a', x: 2, y: 3, vx: 1, vy: -0.5 }];
    expect(predictSpots(tracks, 2000)).toEqual([{ performerId: 'a', x: 4, y: 2 }]);
  });

  it('appearance vetoes a swap that position alone would make', () => {
    // Both dancers STOPPED right where they crossed (velocity useless), and
    // the detections sit slightly closer to the WRONG dancer's spot — but
    // their outfits differ, so the appearance term flips the assignment.
    const lookA = new Float32Array([1, 0]);
    const lookB = new Float32Array([0, 1]);
    const tracks: TrackedSpot[] = [
      { performerId: 'a', x: 3, y: 2, vx: 0, vy: 0, embedding: lookA },
      { performerId: 'b', x: 4, y: 2, vx: 0, vy: 0, embedding: lookB },
    ];
    // a's true detection (looks like a) is nearer b's track and vice versa.
    const detections = [
      { x: 3.8, y: 2 },
      { x: 3.2, y: 2 },
    ];
    const embeddings = [lookA, lookB];
    const positionOnly = assignPointsToPerformers(detections, tracks);
    expect(positionOnly.positions['a']).toEqual({ x: 3.2, y: 2 }); // the swap
    const withLook = assignPointsToPerformers(
      detections,
      tracks,
      appearanceCost(tracks, embeddings),
    );
    expect(withLook.positions['a']).toEqual({ x: 3.8, y: 2 });
    expect(withLook.positions['b']).toEqual({ x: 3.2, y: 2 });
  });

  it('appearance cost is zero when either side lacks an embedding', () => {
    const tracks: TrackedSpot[] = [{ performerId: 'a', x: 0, y: 0, vx: 0, vy: 0 }];
    expect(appearanceCost(tracks, [new Float32Array([1, 0])])(0, 0)).toBe(0);
  });

  it('mergeEmbedding drifts the look without losing its norm', () => {
    const merged = mergeEmbedding(new Float32Array([1, 0]), new Float32Array([0, 1]), 0.2);
    expect(cosineSimilarity(merged, merged)).toBeCloseTo(1); // unit length
    // Still much closer to the old look than the new crop.
    expect(cosineSimilarity(merged, new Float32Array([1, 0]))).toBeGreaterThan(0.9);
  });

  it('keeps two crossing dancers on their own headings (the swap bug)', () => {
    // a walks right at 3 m/s, b walks left at 3 m/s; they pass each other.
    // After 1s: a is at x=5, b at x=2 — matching against LAST positions
    // would swap them (each detection is nearest the OTHER's old spot);
    // matching against the prediction assigns them correctly.
    const tracks: TrackedSpot[] = [
      { performerId: 'a', x: 2, y: 2, vx: 3, vy: 0 },
      { performerId: 'b', x: 5, y: 2, vx: -3, vy: 0 },
    ];
    const detections = [
      { x: 2, y: 2 }, // this is b now
      { x: 5, y: 2 }, // this is a now
    ];
    const staticAssign = assignPointsToPerformers(detections, tracks);
    expect(staticAssign.positions['a']).toEqual({ x: 2, y: 2 }); // the swap
    const predicted = assignPointsToPerformers(detections, predictSpots(tracks, 1000));
    expect(predicted.positions['a']).toEqual({ x: 5, y: 2 });
    expect(predicted.positions['b']).toEqual({ x: 2, y: 2 });
  });
});
