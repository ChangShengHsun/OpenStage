import { describe, expect, it } from 'vitest';
import { templateSpots } from './templates';
import type { TemplateKind } from './templates';

const KINDS: TemplateKind[] = ['line', 'v', 'circle', 'grid'];
const W = 12;
const H = 8;

describe('templateSpots', () => {
  it('returns exactly one spot per performer for every kind and count', () => {
    for (const kind of KINDS) {
      for (const count of [1, 2, 3, 8, 25]) {
        expect(templateSpots(kind, count, W, H)).toHaveLength(count);
      }
    }
  });

  it('keeps every spot at least 1m inside the stage, even for huge casts', () => {
    for (const kind of KINDS) {
      for (const spot of templateSpots(kind, 60, W, H)) {
        expect(spot.x).toBeGreaterThanOrEqual(1);
        expect(spot.x).toBeLessThanOrEqual(W - 1);
        expect(spot.y).toBeGreaterThanOrEqual(1);
        expect(spot.y).toBeLessThanOrEqual(H - 1);
      }
    }
  });

  it('produces distinct spots for reasonable casts', () => {
    for (const kind of KINDS) {
      const spots = templateSpots(kind, 8, W, H);
      const unique = new Set(spots.map((s) => `${s.x.toFixed(3)},${s.y.toFixed(3)}`));
      expect(unique.size).toBe(8);
    }
  });

  it('centers a line horizontally and spaces it evenly', () => {
    const spots = templateSpots('line', 5, W, H);
    expect(spots[2]?.x).toBeCloseTo(W / 2);
    const gaps = spots.slice(1).map((s, i) => s.x - (spots[i]?.x ?? 0));
    for (const g of gaps) expect(g).toBeCloseTo(gaps[0] ?? 0);
  });

  it('V apex is the most downstage spot, arms symmetric', () => {
    const spots = templateSpots('v', 7, W, H);
    const apex = spots[0];
    if (apex === undefined) throw new Error('no apex');
    for (const s of spots.slice(1)) expect(s.y).toBeLessThan(apex.y);
    // pairs mirror around center x
    expect(spots[1]?.x ?? 0).toBeCloseTo(W - (spots[2]?.x ?? 0));
    expect(spots[1]?.y ?? 0).toBeCloseTo(spots[2]?.y ?? -1);
  });

  it('circle spots are equidistant from center', () => {
    const spots = templateSpots('circle', 10, W, H);
    const radii = spots.map((s) => Math.hypot(s.x - W / 2, s.y - H / 2));
    for (const r of radii) expect(r).toBeCloseTo(radii[0] ?? 0, 5);
    expect(radii[0] ?? 0).toBeGreaterThan(1);
  });

  it('handles zero and negative counts gracefully', () => {
    expect(templateSpots('grid', 0, W, H)).toHaveLength(0);
    expect(templateSpots('grid', -3, W, H)).toHaveLength(0);
  });
});
