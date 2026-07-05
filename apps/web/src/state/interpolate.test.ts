import { describe, expect, it } from 'vitest';
import type { Formation } from '@openstage/shared-types';
import type { PositionMap } from './store';
import { formatEightCount, formatTimecode, lerpAngle, posesAtTime, showEndMs } from './interpolate';

function formation(partial: Partial<Formation> & Pick<Formation, 'id' | 'orderIndex'>): Formation {
  return {
    performanceId: 'perf',
    startTimeMs: 0,
    durationMs: 1000,
    transitionType: 'linear',
    name: partial.id,
    ...partial,
  };
}

const f1 = formation({ id: 'f1', orderIndex: 0, startTimeMs: 0, durationMs: 1000 });
const f2 = formation({ id: 'f2', orderIndex: 1, startTimeMs: 3000, durationMs: 1000 });

const positions: PositionMap = {
  f1: { alice: { formationId: 'f1', performerId: 'alice', x: 0, y: 0, rotation: 350 } },
  f2: { alice: { formationId: 'f2', performerId: 'alice', x: 4, y: 2, rotation: 10 } },
};

describe('posesAtTime', () => {
  it('holds the formation position inside its window', () => {
    const poses = posesAtTime([f1, f2], positions, 500);
    expect(poses.get('alice')).toEqual({ x: 0, y: 0, rotation: 350 });
  });

  it('interpolates midway through a transition, rotation via shortest arc', () => {
    // transition runs 1000ms (f1 hold end) -> 3000ms (f2 start); midpoint 2000ms
    const poses = posesAtTime([f1, f2], positions, 2000);
    const alice = poses.get('alice');
    expect(alice).toBeDefined();
    expect(alice?.x).toBeCloseTo(2);
    expect(alice?.y).toBeCloseTo(1);
    // 350° -> 10° crosses 0°, midpoint is 0°, NOT 180°
    expect(alice?.rotation).toBeCloseTo(0);
  });

  it('pins before the first and after the last formation', () => {
    expect(posesAtTime([f1, f2], positions, -50)?.get('alice')?.x).toBe(0);
    expect(posesAtTime([f1, f2], positions, 99_999)?.get('alice')?.x).toBe(4);
  });

  it('returns an empty map with no formations', () => {
    expect(posesAtTime([], {}, 0).size).toBe(0);
  });

  it('handles a zero-length transition without NaN', () => {
    const g2 = formation({ id: 'f2', orderIndex: 1, startTimeMs: 1000, durationMs: 1000 });
    const poses = posesAtTime([f1, g2], positions, 1000);
    const alice = poses.get('alice');
    expect(alice?.x).not.toBeNaN();
  });

  it('keeps a performer missing from the next formation at their current spot', () => {
    const sparse: PositionMap = { f1: positions['f1'] ?? {}, f2: {} };
    const poses = posesAtTime([f1, f2], sparse, 2000);
    expect(poses.get('alice')?.x).toBe(0);
  });
});

describe('helpers', () => {
  it('lerpAngle picks the short way around', () => {
    expect(lerpAngle(350, 10, 0.5)).toBeCloseTo(0);
    expect(lerpAngle(0, 180, 0.5)).toBeCloseTo(90);
  });

  it('showEndMs is the last hold end', () => {
    expect(showEndMs([f1, f2])).toBe(4000);
    expect(showEndMs([])).toBe(0);
  });

  it('formats timecodes', () => {
    expect(formatTimecode(0)).toBe('0:00.0');
    expect(formatTimecode(61_500)).toBe('1:01.5');
    expect(formatTimecode(-5)).toBe('0:00.0');
  });

  it('formats eight-counts at 120 BPM', () => {
    expect(formatEightCount(0, 120)).toBe('8ct 1 · 1');
    // 120 BPM -> 500ms/beat; 4000ms = beat 8 -> second eight, count 1
    expect(formatEightCount(4000, 120)).toBe('8ct 2 · 1');
  });
});
