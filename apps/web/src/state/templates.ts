/**
 * Formation template library: given a performer count and stage size,
 * return one spot per performer (index-aligned with the cast order).
 * All spots stay ≥ MARGIN_M from the stage edges; spacing compresses
 * automatically when the cast outgrows the stage.
 */

export type TemplateKind = 'line' | 'v' | 'circle' | 'grid';

export const TEMPLATE_LABELS: Record<TemplateKind, string> = {
  line: 'Line',
  v: 'V shape',
  circle: 'Circle',
  grid: 'Grid',
};

export interface Spot {
  x: number;
  y: number;
}

const MARGIN_M = 1;
const IDEAL_SPACING_M = 1.5;

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

export function templateSpots(
  kind: TemplateKind,
  count: number,
  stageWidth: number,
  stageHeight: number,
): Spot[] {
  if (count <= 0) return [];
  const usableW = Math.max(stageWidth - MARGIN_M * 2, 0.5);
  const usableH = Math.max(stageHeight - MARGIN_M * 2, 0.5);
  const cx = stageWidth / 2;
  const cy = stageHeight / 2;

  let spots: Spot[];
  switch (kind) {
    case 'line': {
      const spacing = count > 1 ? Math.min(IDEAL_SPACING_M, usableW / (count - 1)) : 0;
      const startX = cx - (spacing * (count - 1)) / 2;
      spots = Array.from({ length: count }, (_, i) => ({ x: startX + i * spacing, y: cy }));
      break;
    }
    case 'v': {
      // Apex downstage center; performers alternate onto the two arms,
      // rising upstage at ~45° per step.
      const pairs = Math.ceil((count - 1) / 2);
      const step =
        pairs > 0 ? Math.min(IDEAL_SPACING_M * 0.75, usableW / 2 / pairs, usableH / pairs) : 0;
      const apexY = cy + (step * pairs) / 2;
      spots = Array.from({ length: count }, (_, i) => {
        if (i === 0) return { x: cx, y: apexY };
        const k = Math.ceil(i / 2);
        const side = i % 2 === 1 ? -1 : 1;
        return { x: cx + side * k * step, y: apexY - k * step };
      });
      break;
    }
    case 'circle': {
      // Radius from desired arc spacing, capped by the stage.
      const wanted = (count * IDEAL_SPACING_M) / (2 * Math.PI);
      const r = clamp(wanted, 0.5, Math.min(usableW, usableH) / 2);
      spots = Array.from({ length: count }, (_, i) => {
        // Start downstage center, go clockwise on the plan.
        const angle = Math.PI / 2 - (2 * Math.PI * i) / count;
        return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
      });
      break;
    }
    case 'grid': {
      const cols = Math.ceil(Math.sqrt(count));
      const rows = Math.ceil(count / cols);
      const sx = cols > 1 ? Math.min(IDEAL_SPACING_M, usableW / (cols - 1)) : 0;
      const sy = rows > 1 ? Math.min(IDEAL_SPACING_M, usableH / (rows - 1)) : 0;
      const startX = cx - (sx * (cols - 1)) / 2;
      const startY = cy - (sy * (rows - 1)) / 2;
      spots = Array.from({ length: count }, (_, i) => ({
        x: startX + (i % cols) * sx,
        y: startY + Math.floor(i / cols) * sy,
      }));
      break;
    }
  }

  return spots.map((s) => ({
    x: clamp(s.x, MARGIN_M, stageWidth - MARGIN_M),
    y: clamp(s.y, MARGIN_M, stageHeight - MARGIN_M),
  }));
}
