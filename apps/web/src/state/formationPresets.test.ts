import { beforeEach, describe, expect, it } from 'vitest';
import {
  applyPresetToCast,
  deleteFormationPreset,
  listFormationPresets,
  saveFormationPreset,
} from './formationPresets';
import type { FormationPosition } from '@openstage/shared-types';

// Node has no localStorage — a Map-backed stub is all this module needs.
const backing = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => backing.get(k) ?? null,
  setItem: (k: string, v: string) => void backing.set(k, v),
  removeItem: (k: string) => void backing.delete(k),
  clear: () => backing.clear(),
  key: () => null,
  length: 0,
} as Storage;

const pos = (x: number, y: number): FormationPosition => ({
  formationId: 'f',
  performerId: 'p',
  x,
  y,
  rotation: 0,
});

beforeEach(() => backing.clear());

describe('formation presets', () => {
  it('saves spots as stage fractions and scales them onto another stage', () => {
    const saved = saveFormationPreset('line', ['a', 'b'], { a: pos(3, 4), b: pos(9, 4) }, 12, 8);
    expect(saved?.spots).toEqual([
      { fx: 0.25, fy: 0.5 },
      { fx: 0.75, fy: 0.5 },
    ]);

    const preset = listFormationPresets()[0];
    expect(preset).toBeDefined();
    if (preset === undefined) return;
    // apply on a 10×6 stage with performers already near their spots
    const result = applyPresetToCast(preset, ['a', 'b'], { a: pos(2, 3), b: pos(8, 3) }, 10, 6);
    expect(result['a']).toEqual({ x: 2.5, y: 3 });
    expect(result['b']).toEqual({ x: 7.5, y: 3 });
  });

  it('assigns spots for minimal walking when sizes match', () => {
    saveFormationPreset('two', ['a', 'b'], { a: pos(2, 4), b: pos(10, 4) }, 12, 8);
    const preset = listFormationPresets()[0];
    if (preset === undefined) throw new Error('preset missing');
    // b already stands left, a stands right — assignment should swap them
    const result = applyPresetToCast(preset, ['a', 'b'], { a: pos(10, 4), b: pos(2, 4) }, 12, 8);
    expect(result['a']).toEqual({ x: 10, y: 4 });
    expect(result['b']).toEqual({ x: 2, y: 4 });
  });

  it('with a size mismatch, spots go to performers in cast order', () => {
    saveFormationPreset(
      'trio',
      ['a', 'b', 'c'],
      { a: pos(2, 2), b: pos(6, 2), c: pos(10, 2) },
      12,
      8,
    );
    const preset = listFormationPresets()[0];
    if (preset === undefined) throw new Error('preset missing');
    const result = applyPresetToCast(preset, ['x', 'y'], {}, 12, 8);
    expect(result['x']).toEqual({ x: 2, y: 2 });
    expect(result['y']).toEqual({ x: 6, y: 2 });
  });

  it('skips performers with no stored position when saving; delete removes', () => {
    const saved = saveFormationPreset('partial', ['a', 'ghost'], { a: pos(6, 4) }, 12, 8);
    expect(saved?.spots).toHaveLength(1);
    if (saved !== null) deleteFormationPreset(saved.id);
    expect(listFormationPresets()).toHaveLength(0);
  });
});
