/**
 * Singleton audio playback + persistence.
 *
 * The uploaded audio file lives in IndexedDB (localStorage can't hold blobs),
 * so a reload keeps the music. One HTMLAudioElement drives playback; waveform
 * peaks are decoded lazily via the Web Audio API and cached.
 */

const DB_NAME = 'openstage-media';
const STORE = 'blobs';
const AUDIO_KEY = 'audio';

let audioEl: HTMLAudioElement | null = null;
let audioBlob: Blob | null = null;
let objectUrl: string | null = null;
let peaksCache: readonly number[] | null = null;
let peaksCacheBins = 0;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'));
  });
}

async function idbPut(key: string, value: Blob | null): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    if (value === null) tx.objectStore(STORE).delete(key);
    else tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB write failed'));
  });
  db.close();
}

async function idbGet(key: string): Promise<Blob | null> {
  const db = await openDb();
  const result = await new Promise<Blob | null>((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result instanceof Blob ? req.result : null);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB read failed'));
  });
  db.close();
  return result;
}

function attach(blob: Blob): void {
  if (objectUrl !== null) URL.revokeObjectURL(objectUrl);
  audioBlob = blob;
  objectUrl = URL.createObjectURL(blob);
  audioEl = new Audio(objectUrl);
  audioEl.preload = 'auto';
  peaksCache = null;
}

export async function setAudioBlob(blob: Blob): Promise<void> {
  attach(blob);
  await idbPut(AUDIO_KEY, blob);
}

let loadPromise: Promise<boolean> | null = null;

/**
 * Restore persisted audio on app start. Resolves true if audio exists.
 * Concurrent calls (React StrictMode double-mounts effects) share one
 * in-flight load, otherwise the second attach() would revoke the blob URL
 * the first Audio element is still reading.
 */
export function loadPersistedAudio(): Promise<boolean> {
  loadPromise ??= (async (): Promise<boolean> => {
    if (audioEl !== null) return true;
    const blob = await idbGet(AUDIO_KEY);
    if (blob === null) return false;
    attach(blob);
    return true;
  })();
  return loadPromise;
}

export async function clearAudio(): Promise<void> {
  if (objectUrl !== null) URL.revokeObjectURL(objectUrl);
  audioEl = null;
  audioBlob = null;
  objectUrl = null;
  peaksCache = null;
  await idbPut(AUDIO_KEY, null);
}

export function getAudioElement(): HTMLAudioElement | null {
  return audioEl;
}

/** Raw uploaded audio, for consumers that need to decode it (video export). */
export function getAudioBlob(): Blob | null {
  return audioBlob;
}

export function audioDurationMs(): number {
  if (audioEl === null || !Number.isFinite(audioEl.duration)) return 0;
  return audioEl.duration * 1000;
}

/** Max-abs amplitude per bin, normalized to [0, 1]. */
export async function getWaveformPeaks(bins: number): Promise<readonly number[]> {
  if (audioBlob === null) return [];
  if (peaksCache !== null && peaksCacheBins === bins) return peaksCache;

  const arrayBuffer = await audioBlob.arrayBuffer();
  const ctx = new AudioContext();
  try {
    const decoded = await ctx.decodeAudioData(arrayBuffer);
    const channel = decoded.getChannelData(0);
    const perBin = Math.max(Math.floor(channel.length / bins), 1);
    const peaks: number[] = new Array<number>(bins).fill(0);
    for (let bin = 0; bin < bins; bin++) {
      let max = 0;
      const start = bin * perBin;
      const end = Math.min(start + perBin, channel.length);
      for (let i = start; i < end; i++) {
        const v = Math.abs(channel[i] ?? 0);
        if (v > max) max = v;
      }
      peaks[bin] = max;
    }
    const top = Math.max(...peaks, 1e-6);
    const normalized = peaks.map((p) => p / top);
    peaksCache = normalized;
    peaksCacheBins = bins;
    return normalized;
  } finally {
    void ctx.close();
  }
}
