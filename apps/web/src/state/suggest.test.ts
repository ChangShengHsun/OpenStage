import { describe, expect, it } from 'vitest';
import { scoreSpacing, scoreSymmetry, suggestFormations } from './suggest';

const ids = (n: number): string[] => Array.from({ length: n }, (_, i) => `p${i}`);

describe('suggestFormations', () => {
  it('returns up to 3 distinct-kind suggestions, best first, inside the stage', () => {
    for (const n of [1, 2, 5, 8, 12]) {
      const suggestions = suggestFormations(ids(n), null, 12, 8);
      expect(suggestions.length).toBeLessThanOrEqual(3);
      expect(suggestions.length).toBeGreaterThan(0);
      const kinds = suggestions.map((s) => s.kind);
      expect(new Set(kinds).size).toBe(kinds.length);
      for (let i = 1; i < suggestions.length; i++) {
        expect(suggestions[i - 1]!.score).toBeGreaterThanOrEqual(suggestions[i]!.score);
      }
      for (const s of suggestions) {
        expect(Object.keys(s.positions)).toHaveLength(n);
        for (const spot of Object.values(s.positions)) {
          expect(spot.x).toBeGreaterThanOrEqual(1);
          expect(spot.x).toBeLessThanOrEqual(11);
          expect(spot.y).toBeGreaterThanOrEqual(1);
          expect(spot.y).toBeLessThanOrEqual(7);
        }
      }
    }
  });

  it('is deterministic', () => {
    const a = suggestFormations(ids(6), null, 12, 8);
    const b = suggestFormations(ids(6), null, 12, 8);
    expect(a).toEqual(b);
  });

  it('assigns spots to minimize walking: no left-right swap', () => {
    // A stands left, B right — every suggested shape should keep that order.
    const previous = { p0: { x: 2, y: 4 }, p1: { x: 10, y: 4 } };
    for (const s of suggestFormations(['p0', 'p1'], previous, 12, 8)) {
      expect(s.positions['p0']!.x).toBeLessThanOrEqual(s.positions['p1']!.x);
    }
  });

  it('returns nothing for an empty cast', () => {
    expect(suggestFormations([], null, 12, 8)).toEqual([]);
  });
});

describe('scoring', () => {
  it('symmetry: mirrored spots score 1, one-sided clumps score low', () => {
    const mirrored = [
      { x: 4, y: 4 },
      { x: 8, y: 4 },
    ];
    const lopsided = [
      { x: 2, y: 4 },
      { x: 3, y: 5 },
    ];
    expect(scoreSymmetry(mirrored, 12)).toBe(1);
    expect(scoreSymmetry(lopsided, 12)).toBeLessThan(0.5);
  });

  it('spacing: overlapping dancers score ~0, an even line scores high', () => {
    const overlap = [
      { x: 5, y: 4 },
      { x: 5.05, y: 4 },
    ];
    const even = [
      { x: 3, y: 4 },
      { x: 4.5, y: 4 },
      { x: 6, y: 4 },
    ];
    expect(scoreSpacing(overlap)).toBeLessThan(0.2);
    expect(scoreSpacing(even)).toBeGreaterThan(0.9);
  });
});
