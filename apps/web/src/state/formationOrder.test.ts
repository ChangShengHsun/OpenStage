import { describe, expect, it } from 'vitest';
import type { Formation } from '@openstage/shared-types';
import { reindexByStart } from './formationOrder';

function f(id: string, orderIndex: number, startTimeMs: number): Formation {
  return {
    id,
    performanceId: 'perf',
    orderIndex,
    startTimeMs,
    durationMs: 1000,
    transitionType: 'linear',
    name: id,
  };
}

const base = [f('a', 0, 0), f('b', 1, 5000), f('c', 2, 10000)];

describe('reindexByStart', () => {
  it('moves a formation later and reorders indices by time', () => {
    // drag 'a' from 0 to 7000 → now sits between b(5000) and c(10000)
    const result = reindexByStart(base, 'a', 7000);
    const byId = Object.fromEntries(result.map((x) => [x.id, x]));
    expect(byId['b']?.orderIndex).toBe(0);
    expect(byId['a']?.orderIndex).toBe(1);
    expect(byId['c']?.orderIndex).toBe(2);
    expect(byId['a']?.startTimeMs).toBe(7000);
  });

  it('clamps negative start times to 0', () => {
    const result = reindexByStart(base, 'b', -500);
    const b = result.find((x) => x.id === 'b');
    expect(b?.startTimeMs).toBe(0);
    // b now ties with a at 0; tiebreak keeps prior order (a had index 0), so
    // a stays first and b lands second.
    expect(result.find((x) => x.id === 'a')?.orderIndex).toBe(0);
    expect(b?.orderIndex).toBe(1);
  });

  it('rounds fractional milliseconds', () => {
    const result = reindexByStart(base, 'c', 3333.7);
    expect(result.find((x) => x.id === 'c')?.startTimeMs).toBe(3334);
  });

  it('leaves order unchanged when start stays in place', () => {
    const result = reindexByStart(base, 'b', 5000);
    expect(result.map((x) => x.id)).toEqual(['a', 'b', 'c']);
    expect(result.map((x) => x.orderIndex)).toEqual([0, 1, 2]);
  });

  it('does not mutate the input array', () => {
    const snapshot = JSON.stringify(base);
    reindexByStart(base, 'a', 9999);
    expect(JSON.stringify(base)).toBe(snapshot);
  });
});
