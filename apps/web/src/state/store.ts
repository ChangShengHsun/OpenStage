import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  DocComment,
  Formation,
  FormationPosition,
  Performance,
  Performer,
} from '@openstage/shared-types';
import {
  DEFAULT_FORMATION_DURATION_MS,
  DEFAULT_STAGE_HEIGHT_M,
  DEFAULT_STAGE_WIDTH_M,
  DEFAULT_TRANSITION_MS,
  PERFORMER_COLORS,
} from '@openstage/shared-types';
import { reindexByStart } from './formationOrder';
import { templateSpots } from './templates';
import type { TemplateKind } from './templates';
import type { RosterRow } from './csv';

/** positions[formationId][performerId] = FormationPosition */
export type PositionMap = Record<string, Record<string, FormationPosition>>;

interface DocState {
  performance: Performance;
  performers: Performer[];
  formations: Formation[];
  positions: PositionMap;
  comments: DocComment[];
}

interface EditorState extends DocState {
  selectedFormationId: string;
  selectedPerformerIds: string[];
  playheadMs: number;
  isPlaying: boolean;

  setTitle: (title: string) => void;
  setStageSize: (width: number, height: number) => void;
  setBpm: (bpm: number | null) => void;

  addPerformer: () => void;
  importRoster: (rows: readonly RosterRow[]) => void;
  removePerformer: (id: string) => void;
  updatePerformer: (id: string, patch: Partial<Omit<Performer, 'id' | 'performanceId'>>) => void;

  addFormation: () => void;
  removeFormation: (id: string) => void;
  updateFormation: (
    id: string,
    patch: Partial<Omit<Formation, 'id' | 'performanceId' | 'orderIndex'>>,
  ) => void;
  moveFormation: (id: string, direction: -1 | 1) => void;
  /** Set start time and re-derive play order; records one undo step. */
  setFormationStart: (id: string, startTimeMs: number) => void;
  /** Same, but WITHOUT recording history — for continuous drag frames. */
  setFormationStartLive: (id: string, startTimeMs: number) => void;
  /** Push the current doc onto the undo stack (checkpoint before a drag). */
  pushHistory: () => void;
  /** Arrange the selected formation's performers into a template shape. */
  applyTemplate: (kind: TemplateKind) => void;

  setPosition: (formationId: string, performerId: string, x: number, y: number) => void;
  setRotation: (formationId: string, performerId: string, rotation: number) => void;
  nudgeSelected: (dx: number, dy: number) => void;
  rotateSelected: (deltaDeg: number) => void;

  selectFormation: (id: string) => void;
  selectPerformer: (id: string, additive: boolean) => void;
  clearPerformerSelection: () => void;

  addBeatMarker: (ms: number) => void;
  removeBeatMarker: (ms: number) => void;

  addComment: (text: string, performerId: string | null, authorName: string) => void;
  removeComment: (id: string) => void;

  setPlayhead: (ms: number) => void;
  setIsPlaying: (playing: boolean) => void;

  undo: () => void;
  redo: () => void;
}

function newId(): string {
  return crypto.randomUUID();
}

function createInitialDoc(): DocState {
  const performanceId = newId();
  const formationId = newId();
  return {
    performance: {
      id: performanceId,
      orgId: 'local',
      title: 'Untitled performance',
      stageWidth: DEFAULT_STAGE_WIDTH_M,
      stageHeight: DEFAULT_STAGE_HEIGHT_M,
      bpm: null,
      audioAssetId: null,
      beatMarkersMs: [],
    },
    performers: [],
    formations: [
      {
        id: formationId,
        performanceId,
        orderIndex: 0,
        startTimeMs: 0,
        durationMs: DEFAULT_FORMATION_DURATION_MS,
        transitionType: 'linear',
        name: 'Formation 1',
      },
    ],
    positions: { [formationId]: {} },
    comments: [],
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Default spot for the index-th cast member: rows across downstage. */
function defaultSpot(
  index: number,
  stageWidth: number,
  stageHeight: number,
): { x: number; y: number } {
  const usable = Math.max(stageWidth - 3, 1);
  const step = 1.5;
  const perRow = Math.max(Math.floor(usable / step), 1);
  return {
    x: clamp(1.5 + (index % perRow) * step, 0, stageWidth),
    y: clamp(stageHeight - 1.5 - Math.floor(index / perRow) * step, 0, stageHeight),
  };
}

function snapshotDoc(s: DocState): DocState {
  return {
    performance: { ...s.performance, beatMarkersMs: [...s.performance.beatMarkersMs] },
    performers: s.performers.map((p) => ({ ...p })),
    formations: s.formations.map((f) => ({ ...f })),
    positions: Object.fromEntries(
      Object.entries(s.positions).map(([fid, byPerformer]) => [
        fid,
        Object.fromEntries(Object.entries(byPerformer).map(([pid, pos]) => [pid, { ...pos }])),
      ]),
    ),
    comments: s.comments.map((c) => ({ ...c })),
  };
}

// ponytail: in-memory snapshot undo (Ctrl+Z), capped ring buffer; move to a
// structural-sharing history if doc sizes ever make this slow.
const UNDO_LIMIT = 50;
const undoStack: DocState[] = [];
const redoStack: DocState[] = [];

export const useEditor = create<EditorState>()(
  persist(
    (set, get) => {
      /** Wraps a doc mutation so it records undo history first. */
      function mutateDoc(fn: (s: EditorState) => Partial<EditorState>): void {
        const before = snapshotDoc(get());
        undoStack.push(before);
        if (undoStack.length > UNDO_LIMIT) undoStack.shift();
        redoStack.length = 0;
        set(fn(get()) as EditorState);
      }

      return {
        ...createInitialDoc(),
        selectedFormationId: '',
        selectedPerformerIds: [],
        playheadMs: 0,
        isPlaying: false,

        setTitle: (title) => mutateDoc((s) => ({ performance: { ...s.performance, title } })),

        setStageSize: (width, height) =>
          mutateDoc((s) => {
            const stageWidth = clamp(width, 2, 60);
            const stageHeight = clamp(height, 2, 60);
            // Keep every stored position on the resized stage.
            const positions: PositionMap = Object.fromEntries(
              Object.entries(s.positions).map(([fid, byPerformer]) => [
                fid,
                Object.fromEntries(
                  Object.entries(byPerformer).map(([pid, pos]) => [
                    pid,
                    { ...pos, x: clamp(pos.x, 0, stageWidth), y: clamp(pos.y, 0, stageHeight) },
                  ]),
                ),
              ]),
            );
            return { performance: { ...s.performance, stageWidth, stageHeight }, positions };
          }),

        setBpm: (bpm) =>
          mutateDoc((s) => ({
            performance: { ...s.performance, bpm: bpm === null ? null : clamp(bpm, 20, 300) },
          })),

        addPerformer: () =>
          mutateDoc((s) => {
            const index = s.performers.length;
            const performer: Performer = {
              id: newId(),
              performanceId: s.performance.id,
              name: `Dancer ${index + 1}`,
              color: PERFORMER_COLORS[index % PERFORMER_COLORS.length] ?? '#e8a84c',
              role: '',
              avatarUrl: null,
            };
            const spot = defaultSpot(index, s.performance.stageWidth, s.performance.stageHeight);
            const positions: PositionMap = { ...s.positions };
            for (const f of s.formations) {
              positions[f.id] = {
                ...positions[f.id],
                [performer.id]: {
                  formationId: f.id,
                  performerId: performer.id,
                  x: spot.x,
                  y: spot.y,
                  rotation: 0,
                },
              };
            }
            return {
              performers: [...s.performers, performer],
              positions,
              selectedPerformerIds: [performer.id],
            };
          }),

        importRoster: (rows) =>
          mutateDoc((s) => {
            if (rows.length === 0) return {};
            const added: Performer[] = rows.map((row, i) => ({
              id: newId(),
              performanceId: s.performance.id,
              name: row.name,
              color:
                row.color ??
                PERFORMER_COLORS[(s.performers.length + i) % PERFORMER_COLORS.length] ??
                '#e8a84c',
              role: row.role,
              avatarUrl: null,
            }));
            const positions: PositionMap = { ...s.positions };
            added.forEach((performer, i) => {
              const spot = defaultSpot(
                s.performers.length + i,
                s.performance.stageWidth,
                s.performance.stageHeight,
              );
              for (const f of s.formations) {
                positions[f.id] = {
                  ...positions[f.id],
                  [performer.id]: {
                    formationId: f.id,
                    performerId: performer.id,
                    x: spot.x,
                    y: spot.y,
                    rotation: 0,
                  },
                };
              }
            });
            return { performers: [...s.performers, ...added], positions };
          }),

        removePerformer: (id) =>
          mutateDoc((s) => {
            const positions: PositionMap = Object.fromEntries(
              Object.entries(s.positions).map(([fid, byPerformer]) => {
                const rest = { ...byPerformer };
                delete rest[id];
                return [fid, rest];
              }),
            );
            return {
              performers: s.performers.filter((p) => p.id !== id),
              positions,
              selectedPerformerIds: s.selectedPerformerIds.filter((pid) => pid !== id),
            };
          }),

        updatePerformer: (id, patch) =>
          mutateDoc((s) => ({
            performers: s.performers.map((p) => (p.id === id ? { ...p, ...patch } : p)),
          })),

        addFormation: () =>
          mutateDoc((s) => {
            const ordered = [...s.formations].sort((a, b) => a.orderIndex - b.orderIndex);
            const last = ordered[ordered.length - 1];
            const id = newId();
            const startTimeMs =
              last !== undefined ? last.startTimeMs + last.durationMs + DEFAULT_TRANSITION_MS : 0;
            const formation: Formation = {
              id,
              performanceId: s.performance.id,
              orderIndex: ordered.length,
              startTimeMs,
              durationMs: DEFAULT_FORMATION_DURATION_MS,
              transitionType: 'linear',
              name: `Formation ${ordered.length + 1}`,
            };
            // New formation starts as a copy of the previous one.
            const copied: Record<string, FormationPosition> =
              last !== undefined
                ? Object.fromEntries(
                    Object.entries(s.positions[last.id] ?? {}).map(([pid, pos]) => [
                      pid,
                      { ...pos, formationId: id },
                    ]),
                  )
                : {};
            return {
              formations: [...s.formations, formation],
              positions: { ...s.positions, [id]: copied },
              selectedFormationId: id,
            };
          }),

        removeFormation: (id) =>
          mutateDoc((s) => {
            if (s.formations.length <= 1) return {};
            const remaining = s.formations
              .filter((f) => f.id !== id)
              .sort((a, b) => a.orderIndex - b.orderIndex)
              .map((f, i) => ({ ...f, orderIndex: i }));
            const positions = { ...s.positions };
            delete positions[id];
            const fallback = remaining[0];
            return {
              formations: remaining,
              positions,
              selectedFormationId:
                s.selectedFormationId === id && fallback !== undefined
                  ? fallback.id
                  : s.selectedFormationId,
            };
          }),

        updateFormation: (id, patch) =>
          mutateDoc((s) => ({
            formations: s.formations.map((f) => (f.id === id ? { ...f, ...patch } : f)),
          })),

        moveFormation: (id, direction) =>
          mutateDoc((s) => {
            const ordered = [...s.formations].sort((a, b) => a.orderIndex - b.orderIndex);
            const index = ordered.findIndex((f) => f.id === id);
            const target = index + direction;
            if (index === -1 || target < 0 || target >= ordered.length) return {};
            const a = ordered[index];
            const b = ordered[target];
            if (a === undefined || b === undefined) return {};
            // Swap slots AND times so the timeline stays monotonic.
            return {
              formations: s.formations.map((f) => {
                if (f.id === a.id)
                  return { ...f, orderIndex: b.orderIndex, startTimeMs: b.startTimeMs };
                if (f.id === b.id)
                  return { ...f, orderIndex: a.orderIndex, startTimeMs: a.startTimeMs };
                return f;
              }),
            };
          }),

        setFormationStart: (id, startTimeMs) =>
          mutateDoc((s) => ({ formations: reindexByStart(s.formations, id, startTimeMs) })),

        setFormationStartLive: (id, startTimeMs) =>
          set((s) => ({ formations: reindexByStart(s.formations, id, startTimeMs) })),

        pushHistory: () => {
          undoStack.push(snapshotDoc(get()));
          if (undoStack.length > UNDO_LIMIT) undoStack.shift();
          redoStack.length = 0;
        },

        applyTemplate: (kind) =>
          mutateDoc((s) => {
            const fid = s.selectedFormationId;
            const byFormation = s.positions[fid];
            if (byFormation === undefined || s.performers.length === 0) return {};
            const spots = templateSpots(
              kind,
              s.performers.length,
              s.performance.stageWidth,
              s.performance.stageHeight,
            );
            const updated = { ...byFormation };
            s.performers.forEach((p, i) => {
              const spot = spots[i];
              const existing = updated[p.id];
              if (spot === undefined || existing === undefined) return;
              updated[p.id] = { ...existing, x: spot.x, y: spot.y };
            });
            return { positions: { ...s.positions, [fid]: updated } };
          }),

        setPosition: (formationId, performerId, x, y) =>
          mutateDoc((s) => {
            const existing = s.positions[formationId]?.[performerId];
            if (existing === undefined) return {};
            return {
              positions: {
                ...s.positions,
                [formationId]: {
                  ...s.positions[formationId],
                  [performerId]: {
                    ...existing,
                    x: clamp(x, 0, s.performance.stageWidth),
                    y: clamp(y, 0, s.performance.stageHeight),
                  },
                },
              },
            };
          }),

        setRotation: (formationId, performerId, rotation) =>
          mutateDoc((s) => {
            const existing = s.positions[formationId]?.[performerId];
            if (existing === undefined) return {};
            const normalized = ((rotation % 360) + 360) % 360;
            return {
              positions: {
                ...s.positions,
                [formationId]: {
                  ...s.positions[formationId],
                  [performerId]: { ...existing, rotation: normalized },
                },
              },
            };
          }),

        nudgeSelected: (dx, dy) => {
          const s = get();
          for (const pid of s.selectedPerformerIds) {
            const pos = s.positions[s.selectedFormationId]?.[pid];
            if (pos !== undefined) {
              get().setPosition(s.selectedFormationId, pid, pos.x + dx, pos.y + dy);
            }
          }
        },

        rotateSelected: (deltaDeg) => {
          const s = get();
          for (const pid of s.selectedPerformerIds) {
            const pos = s.positions[s.selectedFormationId]?.[pid];
            if (pos !== undefined) {
              get().setRotation(s.selectedFormationId, pid, pos.rotation + deltaDeg);
            }
          }
        },

        selectFormation: (id) => set({ selectedFormationId: id }),

        selectPerformer: (id, additive) =>
          set((s) => ({
            selectedPerformerIds: additive
              ? s.selectedPerformerIds.includes(id)
                ? s.selectedPerformerIds.filter((p) => p !== id)
                : [...s.selectedPerformerIds, id]
              : [id],
          })),

        clearPerformerSelection: () => set({ selectedPerformerIds: [] }),

        addBeatMarker: (ms) =>
          mutateDoc((s) => ({
            performance: {
              ...s.performance,
              beatMarkersMs: [...s.performance.beatMarkersMs, Math.max(0, Math.round(ms))].sort(
                (a, b) => a - b,
              ),
            },
          })),

        removeBeatMarker: (ms) =>
          mutateDoc((s) => ({
            performance: {
              ...s.performance,
              beatMarkersMs: s.performance.beatMarkersMs.filter((m) => m !== ms),
            },
          })),

        addComment: (text, performerId, authorName) =>
          mutateDoc((s) => {
            const trimmed = text.trim();
            if (trimmed === '') return {};
            const comment: DocComment = {
              id: newId(),
              formationId: s.selectedFormationId,
              performerId,
              authorName,
              text: trimmed,
              createdAt: new Date().toISOString(),
            };
            return { comments: [...s.comments, comment] };
          }),

        removeComment: (id) =>
          mutateDoc((s) => ({ comments: s.comments.filter((c) => c.id !== id) })),

        setPlayhead: (ms) => set({ playheadMs: Math.max(0, ms) }),
        setIsPlaying: (playing) => set({ isPlaying: playing }),

        undo: () => {
          const prev = undoStack.pop();
          if (prev === undefined) return;
          redoStack.push(snapshotDoc(get()));
          set(prev);
        },

        redo: () => {
          const next = redoStack.pop();
          if (next === undefined) return;
          undoStack.push(snapshotDoc(get()));
          set(next);
        },
      };
    },
    {
      name: 'openstage-doc',
      partialize: (s) => ({
        performance: s.performance,
        performers: s.performers,
        formations: s.formations,
        positions: s.positions,
        comments: s.comments,
      }),
      // Docs saved before the comments feature have no `comments` key —
      // default it so actions never see undefined.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<DocState>;
        return { ...current, ...p, comments: p.comments ?? [] };
      },
    },
  ),
);

/** Ensure a valid formation is always selected (after load or deletion). */
useEditor.subscribe((s) => {
  if (s.formations.length > 0 && !s.formations.some((f) => f.id === s.selectedFormationId)) {
    const first = [...s.formations].sort((a, b) => a.orderIndex - b.orderIndex)[0];
    if (first !== undefined) {
      useEditor.setState({ selectedFormationId: first.id });
    }
  }
});
