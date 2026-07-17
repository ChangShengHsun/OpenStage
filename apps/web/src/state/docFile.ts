import { useEditor } from './store';
import type { DocState } from './store';
import { safeFilename } from '../export/filename';
import { recordExport } from './backupNudge';

/**
 * Choreography file export/import — a plain JSON snapshot of one DocState,
 * the same shape the library slots store. Lets users share a doc without a
 * server and keep browser-independent backups.
 *
 * ponytail: media blobs (audio, stage background) live in IndexedDB and are
 * NOT in the file; the UI says so. Bundling them (zip) is the known upgrade.
 */

/** Pure: doc -> pretty JSON (stable field order comes from the object). */
export function serializeDoc(doc: DocState): string {
  return JSON.stringify(doc, null, 2);
}

/**
 * Pure: parse + validate a choreography file. Returns a normalized DocState
 * (missing optional collections defaulted, mirroring the persist merge in
 * store.ts) or null when the text is not a GridStage document.
 */
export function parseDocFile(text: string): DocState | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof raw !== 'object' || raw === null) return null;
  const d = raw as Partial<DocState>;
  const perf = d.performance;
  if (
    typeof perf !== 'object' ||
    perf === null ||
    typeof perf.id !== 'string' ||
    typeof perf.title !== 'string' ||
    typeof perf.stageWidth !== 'number' ||
    typeof perf.stageHeight !== 'number'
  ) {
    return null;
  }
  if (!Array.isArray(d.performers) || !Array.isArray(d.formations)) return null;
  if (typeof d.positions !== 'object' || d.positions === null || Array.isArray(d.positions)) {
    return null;
  }
  return {
    performance: {
      ...perf,
      sections: perf.sections ?? [],
      countSegments: perf.countSegments ?? [],
    },
    performers: d.performers,
    props: Array.isArray(d.props) ? d.props : [],
    formations: d.formations,
    positions: d.positions,
    comments: Array.isArray(d.comments) ? d.comments : [],
    annotations: Array.isArray(d.annotations) ? d.annotations : [],
  };
}

/** Download the open document as `<title>.gridstage.json`. */
export function exportActiveDocFile(): void {
  const s = useEditor.getState();
  const doc: DocState = {
    performance: s.performance,
    performers: s.performers,
    props: s.props,
    formations: s.formations,
    positions: s.positions,
    comments: s.comments,
    annotations: s.annotations,
  };
  const url = URL.createObjectURL(new Blob([serializeDoc(doc)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeFilename(doc.performance.title)}.gridstage.json`;
  a.click();
  URL.revokeObjectURL(url);
  recordExport(); // quiets the backup nudge for a week
}
