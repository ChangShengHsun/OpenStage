/**
 * Person detection on one video frame (M0 of
 * docs/video-to-formation-killer-app.md). YOLOX-nano (Apache-2.0, see
 * public/models/NOTICE-yolox.txt) via onnxruntime-web: WebGPU when the
 * browser has it, WASM otherwise. The model (3.7MB) and the runtime load
 * lazily on first capture, like the CJK PDF font.
 *
 * The official export is RAW head output (1×3549×85): per anchor
 * [cx, cy, w, h] offsets, objectness, 80 COCO class scores — decoding
 * (grid + stride), NMS and the person filter live here.
 * ponytail: nano is the smallest usable model; if real footage recall is
 * poor, swap the asset for yolox_tiny/s — same decode, bigger download.
 */
import type * as OrtTypes from 'onnxruntime-web';

const MODEL_URL = '/models/yolox_nano.onnx';
const INPUT_SIZE = 416;
const STRIDES = [8, 16, 32];
const PERSON_CLASS = 0;
const SCORE_THRESHOLD = 0.25;
// ponytail: 0.6 keeps overlapping dancers apart (stage clumps are the norm);
// if duplicate boxes for one person show up, this is the knob to lower.
const NMS_IOU = 0.6;

export interface PersonBox {
  /** Box in ORIGINAL image pixels. */
  x: number;
  y: number;
  width: number;
  height: number;
  score: number;
}

/** Test seam: e2e stubs detection so CI never runs the real model. */
export type DetectFn = (image: CanvasImageSource, w: number, h: number) => Promise<PersonBox[]>;
let override: DetectFn | null = null;
export function setDetectorOverride(fn: DetectFn | null): void {
  override = fn;
}

let sessionPromise: Promise<OrtTypes.InferenceSession> | null = null;

async function getSession(): Promise<OrtTypes.InferenceSession> {
  if (sessionPromise === null) {
    sessionPromise = (async () => {
      const ort = await import('onnxruntime-web');
      // WebGPU first; onnxruntime falls back through the list.
      return ort.InferenceSession.create(MODEL_URL, {
        executionProviders: ['webgpu', 'wasm'],
      });
    })();
    // A failed load must be retryable (e.g. flaky network fetching the model).
    sessionPromise.catch(() => {
      sessionPromise = null;
    });
  }
  return sessionPromise;
}

/**
 * Detect people in an image/video frame. Returns boxes in the source's own
 * pixel coordinates, highest score first.
 */
export async function detectPeople(
  image: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
): Promise<PersonBox[]> {
  if (override !== null) return override(image, sourceWidth, sourceHeight);
  const ort = await import('onnxruntime-web');
  const session = await getSession();

  // Letterbox onto a 416×416 canvas, gray padding (YOLOX convention: value
  // 114, BGR channel order, raw 0–255 floats, no normalization).
  const scale = Math.min(INPUT_SIZE / sourceWidth, INPUT_SIZE / sourceHeight);
  const scaledW = Math.round(sourceWidth * scale);
  const scaledH = Math.round(sourceHeight * scale);
  const canvas = document.createElement('canvas');
  canvas.width = INPUT_SIZE;
  canvas.height = INPUT_SIZE;
  const ctx = canvas.getContext('2d');
  if (ctx === null) throw new Error('canvas 2d context unavailable');
  ctx.fillStyle = 'rgb(114, 114, 114)';
  ctx.fillRect(0, 0, INPUT_SIZE, INPUT_SIZE);
  ctx.drawImage(image, 0, 0, scaledW, scaledH);
  const pixels = ctx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE).data;

  const area = INPUT_SIZE * INPUT_SIZE;
  const input = new Float32Array(3 * area);
  for (let i = 0; i < area; i++) {
    // RGBA → planar BGR, raw 0–255.
    input[i] = pixels[i * 4 + 2] ?? 0;
    input[area + i] = pixels[i * 4 + 1] ?? 0;
    input[2 * area + i] = pixels[i * 4] ?? 0;
  }

  const feeds = { images: new ort.Tensor('float32', input, [1, 3, INPUT_SIZE, INPUT_SIZE]) };
  const results = await session.run(feeds);
  const output = results['output'];
  if (output === undefined) throw new Error('model returned no "output" tensor');
  const data = output.data as Float32Array;

  const candidates = decodeRawHead(data);
  const kept = nonMaxSuppression(candidates, NMS_IOU);
  // Undo the letterbox back to source pixels.
  return kept.map((b) => ({
    x: b.x / scale,
    y: b.y / scale,
    width: b.width / scale,
    height: b.height / scale,
    score: b.score,
  }));
}

/** Decode the raw YOLOX head: grid offsets + exp(wh)·stride, person only. */
function decodeRawHead(data: Float32Array): PersonBox[] {
  const boxes: PersonBox[] = [];
  let anchor = 0;
  for (const stride of STRIDES) {
    const grid = INPUT_SIZE / stride;
    for (let gy = 0; gy < grid; gy++) {
      for (let gx = 0; gx < grid; gx++) {
        const base = anchor * 85;
        anchor += 1;
        const objectness = data[base + 4] ?? 0;
        const personScore = (data[base + 5 + PERSON_CLASS] ?? 0) * objectness;
        if (personScore < SCORE_THRESHOLD) continue;
        const cx = ((data[base] ?? 0) + gx) * stride;
        const cy = ((data[base + 1] ?? 0) + gy) * stride;
        const w = Math.exp(data[base + 2] ?? 0) * stride;
        const h = Math.exp(data[base + 3] ?? 0) * stride;
        boxes.push({ x: cx - w / 2, y: cy - h / 2, width: w, height: h, score: personScore });
      }
    }
  }
  return boxes.sort((a, b) => b.score - a.score);
}

/** Standard greedy NMS on score-sorted boxes. */
export function nonMaxSuppression(sorted: readonly PersonBox[], iouLimit: number): PersonBox[] {
  const kept: PersonBox[] = [];
  for (const box of sorted) {
    if (kept.every((k) => iou(k, box) < iouLimit)) kept.push(box);
  }
  return kept;
}

function iou(a: PersonBox, b: PersonBox): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.width, b.x + b.width);
  const y2 = Math.min(a.y + a.height, b.y + b.height);
  const overlap = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const union = a.width * a.height + b.width * b.height - overlap;
  return union <= 0 ? 0 : overlap / union;
}

/** Foot point of a person box: bottom-center — where they stand on the floor. */
export function footPoint(box: PersonBox): { x: number; y: number } {
  return { x: box.x + box.width / 2, y: box.y + box.height };
}
