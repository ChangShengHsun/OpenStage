import type { Performer } from '@openstage/shared-types';
import type { RosterRow } from './csv';

/**
 * Crews — named rosters saved in this browser, reusable across library
 * documents (save your team once, load it into next semester's show).
 * Loading goes through the existing importRoster action, so members join
 * the cast with default spots exactly like a CSV import.
 */

export interface Crew {
  id: string;
  name: string;
  savedAt: string;
  members: RosterRow[];
}

const CREWS_KEY = 'openstage-crews';

function readCrews(): Crew[] {
  try {
    const raw = localStorage.getItem(CREWS_KEY);
    return raw === null ? [] : (JSON.parse(raw) as Crew[]);
  } catch {
    return [];
  }
}

function writeCrews(crews: readonly Crew[]): void {
  localStorage.setItem(CREWS_KEY, JSON.stringify(crews));
}

/** Newest first. */
export function listCrews(): Crew[] {
  return readCrews();
}

export function saveCrew(name: string, performers: readonly Performer[]): Crew {
  const crew: Crew = {
    id: crypto.randomUUID(),
    name,
    savedAt: new Date().toISOString(),
    members: performers.map((p) => ({
      name: p.name,
      role: p.role,
      color: p.color,
      ...(p.tags !== undefined && p.tags.length > 0 ? { tags: [...p.tags] } : {}),
    })),
  };
  writeCrews([crew, ...readCrews()]);
  return crew;
}

export function deleteCrew(id: string): void {
  writeCrews(readCrews().filter((c) => c.id !== id));
}
