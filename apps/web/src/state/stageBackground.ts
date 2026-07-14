import { create } from 'zustand';
import { idbGet, idbPut } from '../media/blobStore';

/**
 * Stage background image — a venue photo drawn under the grid. The blob is
 * local to this browser (IndexedDB, one key per library document); only its
 * opacity travels with the doc. This store holds the decoded image for the
 * OPEN document so the canvas can draw it.
 */

const bgKey = (docId: string): string => `bg:${docId}`;

function toImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Not a readable image'));
    };
    img.src = url;
  });
}

function release(img: HTMLImageElement | null): void {
  if (img !== null) URL.revokeObjectURL(img.src);
}

interface BackgroundState {
  /** Which document the loaded image belongs to. */
  docId: string | null;
  image: HTMLImageElement | null;
  /** Load the given document's background (no-op if already loaded). */
  load: (docId: string) => Promise<void>;
  set: (docId: string, blob: Blob) => Promise<void>;
  clear: (docId: string) => Promise<void>;
}

export const useStageBackground = create<BackgroundState>()((set, get) => ({
  docId: null,
  image: null,

  load: async (docId) => {
    if (get().docId === docId) return;
    set({ docId, image: null });
    const blob = await idbGet(bgKey(docId));
    if (get().docId !== docId) return; // a newer switch won the race
    if (blob === null) return;
    const image = await toImage(blob);
    if (get().docId !== docId) {
      release(image);
      return;
    }
    set({ image });
  },

  set: async (docId, blob) => {
    const image = await toImage(blob); // reject bad files before persisting
    await idbPut(bgKey(docId), blob);
    release(get().image);
    set({ docId, image });
  },

  clear: async (docId) => {
    await idbPut(bgKey(docId), null);
    if (get().docId === docId) {
      release(get().image);
      set({ image: null });
    }
  },
}));

/** Library duplicate: the copy keeps the same venue photo. */
export async function copyBackgroundBetweenDocs(fromDocId: string, toDocId: string): Promise<void> {
  const blob = await idbGet(bgKey(fromDocId));
  if (blob !== null) await idbPut(bgKey(toDocId), blob);
}

export async function deleteBackgroundForDoc(docId: string): Promise<void> {
  await idbPut(bgKey(docId), null);
}
