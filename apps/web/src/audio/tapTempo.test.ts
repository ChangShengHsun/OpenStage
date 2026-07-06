import { describe, expect, it } from 'vitest';
import { appendTap, bpmFromTaps, TAP_RESET_MS } from './tapTempo';

describe('bpmFromTaps', () => {
  it('measures 120 BPM from taps 500ms apart', () => {
    expect(bpmFromTaps([0, 500, 1000, 1500, 2000])).toBeCloseTo(120, 5);
  });

  it('averages out per-tap jitter', () => {
    // 500ms nominal with ±40ms wobble; span-based estimate stays exact-ish.
    const bpm = bpmFromTaps([0, 540, 960, 1510, 2000]);
    expect(Math.abs((bpm ?? 0) - 120)).toBeLessThanOrEqual(1);
  });

  it('needs at least two taps', () => {
    expect(bpmFromTaps([])).toBeNull();
    expect(bpmFromTaps([1000])).toBeNull();
  });

  it('rejects zero span (double-click same instant)', () => {
    expect(bpmFromTaps([1000, 1000])).toBeNull();
  });
});

describe('appendTap', () => {
  it('appends while the run is alive', () => {
    expect(appendTap([0, 500], 1000)).toEqual([0, 500, 1000]);
  });

  it('restarts after a long pause', () => {
    expect(appendTap([0, 500], 500 + TAP_RESET_MS + 1)).toEqual([500 + TAP_RESET_MS + 1]);
  });

  it('starts a run from empty', () => {
    expect(appendTap([], 42)).toEqual([42]);
  });
});
