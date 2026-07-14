import type { FormationPosition } from '@openstage/shared-types';
import { planTransition } from '@openstage/path-planner';

/**
 * Formation presets — shapes YOU designed, saved in this browser and
 * reusable in any formation of any document. Spots are stored as fractions
 * of the stage (0–1), so a preset saved on a 12×8m stage still makes sense
 * on a 10×6m one. Rotation is not saved — presets are about placement.
 */

export interface FormationPreset {
  id: string;
  name: string;
  savedAt: string;
  /** Per-spot fractions of stage width/height, in cast order at save time. */
  spots: { fx: number; fy: number }[];
}

const PRESETS_KEY = 'openstage-presets';

function readPresets(): FormationPreset[] {
  try {
    const raw = localStorage.getItem(PRESETS_KEY);
    return raw === null ? [] : (JSON.parse(raw) as FormationPreset[]);
  } catch {
    return [];
  }
}

function writePresets(presets: readonly FormationPreset[]): void {
  localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
}

/** Newest first. */
export function listFormationPresets(): FormationPreset[] {
  return readPresets();
}

export function deleteFormationPreset(id: string): void {
  writePresets(readPresets().filter((p) => p.id !== id));
}

export function saveFormationPreset(
  name: string,
  performerIds: readonly string[],
  positions: Readonly<Record<string, FormationPosition>>,
  stageWidth: number,
  stageHeight: number,
): FormationPreset | null {
  const spots: { fx: number; fy: number }[] = [];
  for (const id of performerIds) {
    const pos = positions[id];
    if (pos !== undefined) spots.push({ fx: pos.x / stageWidth, fy: pos.y / stageHeight });
  }
  if (spots.length === 0) return null;
  const preset: FormationPreset = {
    id: crypto.randomUUID(),
    name,
    savedAt: new Date().toISOString(),
    spots,
  };
  writePresets([preset, ...readPresets()]);
  return preset;
}

/**
 * Map a preset onto the current cast: spots scale to this stage, and when
 * the cast size matches the preset, who-takes-which-spot is assigned for
 * minimal total walking from where everyone stands now (Hungarian). With a
 * size mismatch, spots go to performers in cast order (extras stay put).
 */
export function applyPresetToCast(
  preset: FormationPreset,
  performerIds: readonly string[],
  currentPositions: Readonly<Record<string, FormationPosition>>,
  stageWidth: number,
  stageHeight: number,
): Record<string, { x: number; y: number }> {
  const spots = preset.spots.map((s) => ({ x: s.fx * stageWidth, y: s.fy * stageHeight }));
  const result: Record<string, { x: number; y: number }> = {};

  const currentSpots = performerIds.map((id) => currentPositions[id]);
  if (spots.length === performerIds.length && currentSpots.every((p) => p !== undefined)) {
    const plan = planTransition(
      currentSpots.map((p) => ({ x: (p as FormationPosition).x, y: (p as FormationPosition).y })),
      spots,
    );
    performerIds.forEach((id, i) => {
      const spot = spots[plan.assignment[i] ?? i];
      if (spot !== undefined) result[id] = spot;
    });
    return result;
  }

  performerIds.forEach((id, i) => {
    const spot = spots[i];
    if (spot !== undefined) result[id] = spot;
  });
  return result;
}
