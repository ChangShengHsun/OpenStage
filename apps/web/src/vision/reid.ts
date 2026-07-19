/**
 * Appearance embeddings for identity tracking (Re-ID): osnet_ain_x1_0
 * (MIT-licensed torchreid; the multi-source domain-generalization
 * checkpoint — see public/models/NOTICE-osnet.txt) turns each detected
 * person's crop into a 512-dim vector; crops of the SAME person land close
 * in cosine similarity even frames apart. The scan mixes this into the
 * matching cost so two crossing dancers in different outfits cannot trade
 * identities.
 *
 * Honest ceiling: identical costumes embed identically — appearance then
 * adds nothing and matching falls back to position + velocity.
 */
import type * as OrtTypes from 'onnxruntime-web';
import type { PersonBox } from './detector';

const MODEL_URL = `${import.meta.env.BASE_URL}models/osnet_ain_x1_0.onnx`;
const INPUT_W = 128;
const INPUT_H = 256;
/** torchreid Normalize: ImageNet RGB mean/std on 0–1 pixels. */
const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];

/** Test seam like the detector's: e2e can stub embeddings. */
export type EmbedPeopleFn = (
  image: CanvasImageSource,
  boxes: readonly PersonBox[],
) => Promise<(Float32Array | null)[]>;
let override: EmbedPeopleFn | null = null;
export function setReidOverride(fn: EmbedPeopleFn | null): void {
  override = fn;
}

let sessionPromise: Promise<OrtTypes.InferenceSession> | null = null;

async function getSession(): Promise<OrtTypes.InferenceSession> {
  if (sessionPromise === null) {
    sessionPromise = (async () => {
      const ort = await import('onnxruntime-web');
      return ort.InferenceSession.create(MODEL_URL, {
        executionProviders: ['webgpu', 'wasm'],
      });
    })();
    sessionPromise.catch(() => {
      sessionPromise = null;
    });
  }
  return sessionPromise;
}

/**
 * L2-normalized appearance embedding per box (order matches the input).
 * Never throws: if the model cannot load, every entry is null and the
 * caller matches on position alone.
 */
export async function embedPeople(
  image: CanvasImageSource,
  boxes: readonly PersonBox[],
): Promise<(Float32Array | null)[]> {
  if (override !== null) return override(image, boxes);
  try {
    const ort = await import('onnxruntime-web');
    const session = await getSession();
    const results: (Float32Array | null)[] = [];
    for (const box of boxes) {
      results.push(await embedBox(ort, session, image, box));
    }
    return results;
  } catch {
    return boxes.map(() => null);
  }
}

async function embedBox(
  ort: typeof OrtTypes,
  session: OrtTypes.InferenceSession,
  image: CanvasImageSource,
  box: PersonBox,
): Promise<Float32Array | null> {
  const canvas = document.createElement('canvas');
  canvas.width = INPUT_W;
  canvas.height = INPUT_H;
  const ctx = canvas.getContext('2d');
  if (ctx === null) return null;
  ctx.drawImage(image, box.x, box.y, box.width, box.height, 0, 0, INPUT_W, INPUT_H);
  const pixels = ctx.getImageData(0, 0, INPUT_W, INPUT_H).data;

  const area = INPUT_W * INPUT_H;
  const input = new Float32Array(3 * area);
  for (let i = 0; i < area; i++) {
    // RGBA → planar RGB, 0–1 then ImageNet-normalized.
    input[i] = ((pixels[i * 4] ?? 0) / 255 - (MEAN[0] ?? 0)) / (STD[0] ?? 1);
    input[area + i] = ((pixels[i * 4 + 1] ?? 0) / 255 - (MEAN[1] ?? 0)) / (STD[1] ?? 1);
    input[2 * area + i] = ((pixels[i * 4 + 2] ?? 0) / 255 - (MEAN[2] ?? 0)) / (STD[2] ?? 1);
  }
  const feeds = { images: new ort.Tensor('float32', input, [1, 3, INPUT_H, INPUT_W]) };
  const out = await session.run(feeds);
  const embedding = out['embedding'];
  if (embedding === undefined) return null;
  return l2Normalize(new Float32Array(embedding.data as Float32Array));
}

function l2Normalize(v: Float32Array): Float32Array {
  let sum = 0;
  for (const x of v) sum += x * x;
  const norm = Math.sqrt(sum);
  if (norm < 1e-12) return v;
  for (let i = 0; i < v.length; i++) (v as Float32Array)[i] = (v[i] ?? 0) / norm;
  return v;
}

/** Cosine similarity of two L2-normalized embeddings. */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) dot += (a[i] ?? 0) * (b[i] ?? 0);
  return dot;
}

/**
 * Exponential moving average of a track's appearance — slowly absorbs
 * lighting/angle changes without letting one bad crop overwrite the look.
 */
export function mergeEmbedding(
  previous: Float32Array | null,
  next: Float32Array,
  alpha = 0.2,
): Float32Array {
  if (previous === null) return next;
  const merged = new Float32Array(next.length);
  for (let i = 0; i < merged.length; i++) {
    merged[i] = (1 - alpha) * (previous[i] ?? 0) + alpha * (next[i] ?? 0);
  }
  return l2Normalize(merged);
}
