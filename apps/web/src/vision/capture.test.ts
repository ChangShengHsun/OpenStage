import { describe, expect, it } from 'vitest';
import { assignPointsToPerformers } from './capture';
import type { ReferenceSpot } from './capture';

const ref = (id: string, x: number, y: number): ReferenceSpot => ({ performerId: id, x, y });

describe('assignPointsToPerformers', () => {
  it('assigns each point to the nearest dancer when the mapping is clear', () => {
    const result = assignPointsToPerformers(
      [
        { x: 2.1, y: 3.0 },
        { x: 9.9, y: 5.1 },
      ],
      [ref('a', 2, 3), ref('b', 10, 5)],
    );
    expect(result.positions['a']).toEqual({ x: 2.1, y: 3.0 });
    expect(result.positions['b']).toEqual({ x: 9.9, y: 5.1 });
    expect(result.uncertainIds).toEqual([]);
    expect(result.detectedCount).toBe(2);
  });

  it('flags near-ties as uncertain', () => {
    // Both detections are almost equally close to both dancers.
    const result = assignPointsToPerformers(
      [
        { x: 5.0, y: 4.0 },
        { x: 5.4, y: 4.0 },
      ],
      [ref('a', 5.1, 4), ref('b', 5.3, 4)],
    );
    expect(Object.keys(result.positions)).toHaveLength(2);
    expect(result.uncertainIds).toContain('a');
    expect(result.uncertainIds).toContain('b');
  });

  it('leaves undetected dancers untouched (fewer points than dancers)', () => {
    const result = assignPointsToPerformers(
      [{ x: 2, y: 3 }],
      [ref('a', 2.2, 3), ref('b', 10, 5)],
    );
    expect(result.positions['a']).toEqual({ x: 2, y: 3 });
    expect(result.positions['b']).toBeUndefined();
  });

  it('drops extra detections (more points than dancers)', () => {
    const result = assignPointsToPerformers(
      [
        { x: 2, y: 3 },
        { x: 6, y: 6 },
        { x: 11, y: 2 },
      ],
      [ref('a', 2.2, 3)],
    );
    expect(Object.keys(result.positions)).toEqual(['a']);
    expect(result.positions['a']).toEqual({ x: 2, y: 3 });
    expect(result.detectedCount).toBe(3);
  });

  it('handles the empty cases', () => {
    expect(assignPointsToPerformers([], []).positions).toEqual({});
    expect(assignPointsToPerformers([], [ref('a', 1, 1)]).positions).toEqual({});
    expect(assignPointsToPerformers([{ x: 1, y: 1 }], []).positions).toEqual({});
  });
});
