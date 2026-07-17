/**
 * Facing estimation (M1 of docs/video-to-formation-killer-app.md):
 * RTMPose-t (Apache-2.0, see public/models/NOTICE-rtmpose.txt) on each
 * detected person's crop gives 17 COCO keypoints; the shoulder line
 * projected onto the stage floor gives the facing direction, and the
 * image-space shoulder ORDER tells camera-facing from back-turned
 * (a mirrored person facing you has their left shoulder on your right).
 *
 * Runs only in single-frame capture, not the whole-video scan — one pose
 * pass per dancer is fine for a click, too slow for 1s sampling on wasm.
 */
import type * as OrtTypes from 'onnxruntime-web';
import type { PersonBox } from './detector';
import { applyHomography, normalizeStageRotation } from './homography';
import type { Homography, Point2 } from './homography';

const MODEL_URL = '/models/rtmpose-t.onnx';
const INPUT_W = 192;
const INPUT_H = 256;
const SIMCC_RATIO = 2;
/** mmpose Normalize (to_rgb): per-channel RGB mean/std. */
const MEAN = [123.675, 116.28, 103.53];
const STD = [58.395, 57.12, 57.375];
/** COCO keypoint indices. */
const LEFT_SHOULDER = 5;
const RIGHT_SHOULDER = 6;
/** SimCC peak below this = shoulder not really visible; skip facing. */
const MIN_SHOULDER_SCORE = 0.3;
/** mmpose TopDownGetBboxCenterScale padding. */
const BOX_PADDING = 1.25;

export interface FacingEstimate {
  /** Stage rotation in degrees (0 = facing audience, clockwise+). */
  rotation: number;
}

/** Test seam like the detector's: e2e stubs pose estimation. */
export type EstimateFacingsFn = (
  image: CanvasImageSource,
  boxes: readonly PersonBox[],
  homography: Homography,
) => Promise<(FacingEstimate | null)[]>;
let override: EstimateFacingsFn | null = null;
export function setPoseOverride(fn: EstimateFacingsFn | null): void {
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
 * Estimate the stage facing for each person box; null where shoulders are
 * not confidently visible. Order matches the input boxes.
 */
export async function estimateFacings(
  image: CanvasImageSource,
  boxes: readonly PersonBox[],
  homography: Homography,
): Promise<(FacingEstimate | null)[]> {
  if (override !== null) return override(image, boxes, homography);
  const ort = await import('onnxruntime-web');
  const session = await getSession();
  const results: (FacingEstimate | null)[] = [];
  for (const box of boxes) {
    results.push(await facingForBox(ort, session, image, box, homography));
  }
  return results;
}

async function facingForBox(
  ort: typeof OrtTypes,
  session: OrtTypes.InferenceSession,
  image: CanvasImageSource,
  box: PersonBox,
  homography: Homography,
): Promise<FacingEstimate | null> {
  // mmpose-style crop: pad the box, then fix its aspect to 192:256.
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  let cw = box.width * BOX_PADDING;
  let ch = box.height * BOX_PADDING;
  const targetAspect = INPUT_W / INPUT_H;
  if (cw / ch > targetAspect) ch = cw / targetAspect;
  else cw = ch * targetAspect;

  const canvas = document.createElement('canvas');
  canvas.width = INPUT_W;
  canvas.height = INPUT_H;
  const ctx = canvas.getContext('2d');
  if (ctx === null) throw new Error('canvas 2d context unavailable');
  ctx.fillStyle = 'rgb(0, 0, 0)';
  ctx.fillRect(0, 0, INPUT_W, INPUT_H);
  ctx.drawImage(image, cx - cw / 2, cy - ch / 2, cw, ch, 0, 0, INPUT_W, INPUT_H);
  const pixels = ctx.getImageData(0, 0, INPUT_W, INPUT_H).data;

  const area = INPUT_W * INPUT_H;
  const input = new Float32Array(3 * area);
  for (let i = 0; i < area; i++) {
    // RGBA → planar RGB, normalized.
    input[i] = ((pixels[i * 4] ?? 0) - (MEAN[0] ?? 0)) / (STD[0] ?? 1);
    input[area + i] = ((pixels[i * 4 + 1] ?? 0) - (MEAN[1] ?? 0)) / (STD[1] ?? 1);
    input[2 * area + i] = ((pixels[i * 4 + 2] ?? 0) - (MEAN[2] ?? 0)) / (STD[2] ?? 1);
  }
  const feeds = { input: new ort.Tensor('float32', input, [1, 3, INPUT_H, INPUT_W]) };
  const out = await session.run(feeds);
  const simccX = out['simcc_x'];
  const simccY = out['simcc_y'];
  if (simccX === undefined || simccY === undefined) return null;

  const left = decodeKeypoint(simccX.data as Float32Array, simccY.data as Float32Array, LEFT_SHOULDER);
  const right = decodeKeypoint(
    simccX.data as Float32Array,
    simccY.data as Float32Array,
    RIGHT_SHOULDER,
  );
  if (left.score < MIN_SHOULDER_SCORE || right.score < MIN_SHOULDER_SCORE) return null;

  // Crop coords → image coords.
  const toImage = (p: Point2): Point2 => ({
    x: cx - cw / 2 + (p.x / INPUT_W) * cw,
    y: cy - ch / 2 + (p.y / INPUT_H) * ch,
  });
  const rotation = shoulderRotation(toImage(left), toImage(right), homography);
  return rotation === null ? null : { rotation };
}

/** SimCC decode: per keypoint, argmax of the 1D x and y distributions. */
export function decodeKeypoint(
  simccX: Float32Array,
  simccY: Float32Array,
  keypoint: number,
): { x: number; y: number; score: number } {
  const xBins = INPUT_W * SIMCC_RATIO;
  const yBins = INPUT_H * SIMCC_RATIO;
  let bestX = 0;
  let bestXv = -Infinity;
  for (let i = 0; i < xBins; i++) {
    const v = simccX[keypoint * xBins + i] ?? -Infinity;
    if (v > bestXv) {
      bestXv = v;
      bestX = i;
    }
  }
  let bestY = 0;
  let bestYv = -Infinity;
  for (let i = 0; i < yBins; i++) {
    const v = simccY[keypoint * yBins + i] ?? -Infinity;
    if (v > bestYv) {
      bestYv = v;
      bestY = i;
    }
  }
  return { x: bestX / SIMCC_RATIO, y: bestY / SIMCC_RATIO, score: Math.min(bestXv, bestYv) };
}

/**
 * Pure: image-space shoulder points → stage rotation.
 * The keypoints are ANATOMICALLY labeled (the model knows a left shoulder
 * from a right one by appearance), so no camera-mirror guessing is needed:
 * project both shoulders onto the floor, take the body's left direction
 * (right→left shoulder), and the facing is that direction turned 90°
 * clockwise (face the audience and your left hand points stage-house-left,
 * i.e. +x). Works for every orientation including profiles.
 */
export function shoulderRotation(
  leftShoulderImg: Point2,
  rightShoulderImg: Point2,
  homography: Homography,
): number | null {
  const l = applyHomography(homography, leftShoulderImg);
  const r = applyHomography(homography, rightShoulderImg);
  const leftX = l.x - r.x;
  const leftY = l.y - r.y;
  const len = Math.hypot(leftX, leftY);
  if (!Number.isFinite(len) || len < 1e-6) return null;
  // Rotate the left direction 90° clockwise (y-down plan): (x, y) → (−y, x).
  const fx = -leftY / len;
  const fy = leftX / len;
  // Facing vector of rotation r is (−sin r, cos r) → r = atan2(−fx, fy).
  return normalizeStageRotation((Math.atan2(-fx, fy) * 180) / Math.PI);
}
