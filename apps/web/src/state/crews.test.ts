import { beforeEach, describe, expect, it } from 'vitest';
import { deleteCrew, listCrews, saveCrew } from './crews';
import type { Performer } from '@openstage/shared-types';

// Node has no localStorage — a Map-backed stub is all crews.ts needs.
const backing = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => backing.get(k) ?? null,
  setItem: (k: string, v: string) => void backing.set(k, v),
  removeItem: (k: string) => void backing.delete(k),
  clear: () => backing.clear(),
  key: () => null,
  length: 0,
} as Storage;

const performers: Performer[] = [
  {
    id: 'p1',
    performanceId: 'perf',
    name: 'Amy',
    role: 'captain',
    color: '#e05252',
    avatarUrl: null,
    tags: ['front row'],
  },
  { id: 'p2', performanceId: 'perf', name: 'Ben', role: '', color: '#52a0e0', avatarUrl: null },
];

beforeEach(() => {
  localStorage.removeItem('openstage-crews');
});

describe('crews', () => {
  it('save/list round-trips members as roster rows, keeping tags', () => {
    saveCrew('Team 2026', performers);
    const crews = listCrews();
    expect(crews).toHaveLength(1);
    expect(crews[0]?.name).toBe('Team 2026');
    expect(crews[0]?.members).toEqual([
      { name: 'Amy', role: 'captain', color: '#e05252', tags: ['front row'] },
      { name: 'Ben', role: '', color: '#52a0e0' },
    ]);
  });

  it('deleteCrew removes only the given crew', () => {
    const a = saveCrew('A', performers);
    saveCrew('B', performers);
    deleteCrew(a.id);
    expect(listCrews().map((c) => c.name)).toEqual(['B']);
  });

  it('survives corrupt storage', () => {
    localStorage.setItem('openstage-crews', '{not json');
    expect(listCrews()).toEqual([]);
  });
});
