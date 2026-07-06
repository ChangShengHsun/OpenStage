import { describe, expect, it } from 'vitest';
import { alignSpots, distributeSpots, mirrorAcrossX, swapSpots } from './formationTransform';
import type { Spot } from './formationTransform';

const spot = (id: string, x: number, y: number, rotation = 0): Spot => ({ id, x, y, rotation });

describe('mirrorAcrossX', () => {
  it('reflects x across the center and flips facing', () => {
    const out = mirrorAcrossX([spot('a', 2, 3, 45), spot('b', 10, 3, 0)], 12);
    expect(out[0]).toEqual({ id: 'a', x: 10, y: 3, rotation: 315 });
    expect(out[1]).toEqual({ id: 'b', x: 2, y: 3, rotation: 0 });
  });

  it('is its own inverse', () => {
    const original = [spot('a', 2, 3, 45), spot('b', 9, 1, 200)];
    const twice = mirrorAcrossX(mirrorAcrossX(original, 12), 12);
    expect(twice).toEqual(original);
  });
});

describe('alignSpots', () => {
  it('row alignment gives everyone the average y', () => {
    const out = alignSpots([spot('a', 1, 2), spot('b', 5, 4)], 'row');
    expect(out.map((s) => s.y)).toEqual([3, 3]);
    expect(out.map((s) => s.x)).toEqual([1, 5]); // x untouched
  });

  it('col alignment gives everyone the average x', () => {
    const out = alignSpots([spot('a', 2, 1), spot('b', 6, 9)], 'col');
    expect(out.map((s) => s.x)).toEqual([4, 4]);
  });
});

describe('distributeSpots', () => {
  it('spaces the middle spots evenly between the extremes', () => {
    const out = distributeSpots([spot('a', 0, 0), spot('c', 9, 0), spot('b', 1, 0)], 'x');
    // sorted by x: a(0), b(1), c(9) -> even step 4.5
    expect(out.map((s) => s.x)).toEqual([0, 4.5, 9]);
    expect(out.map((s) => s.id)).toEqual(['a', 'b', 'c']);
  });

  it('does nothing with fewer than three', () => {
    const input = [spot('a', 0, 0), spot('b', 9, 0)];
    expect(distributeSpots(input, 'x')).toEqual(input);
  });
});

describe('swapSpots', () => {
  it('exchanges position and facing, keeps ids', () => {
    const { a, b } = swapSpots(spot('a', 1, 1, 10), spot('b', 5, 5, 90));
    expect(a).toEqual({ id: 'a', x: 5, y: 5, rotation: 90 });
    expect(b).toEqual({ id: 'b', x: 1, y: 1, rotation: 10 });
  });
});
