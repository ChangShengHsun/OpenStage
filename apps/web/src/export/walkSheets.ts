import { jsPDF } from 'jspdf';
import { useEditor } from '../state/store';
import { byOrder, formatTimecode } from '../state/interpolate';
import { safeFilename } from './filename';

// A4 landscape, millimeters — same sheet conventions as pdf.ts.
const PAGE_W = 297;
const PAGE_H = 210;
const MARGIN = 16;
const HEADER_H = 20;

const INK = '#26221e';
const DIM = '#8a8074';

/** jsPDF's built-in fonts have no CJK glyphs; only draw text that will render. */
function pdfSafe(text: string): string {
  return Array.from(text).some((c) => (c.codePointAt(0) ?? 0) > 0xff) ? '' : text;
}

/**
 * Personal walk sheets: one page per performer with THEIR positions across
 * the whole show — a numbered route on the stage plan plus a table of
 * formation, time window, position, and facing. The printable handout each
 * dancer rehearses from.
 *
 * ponytail: transition legs draw as straight dashed lines even for curve
 * transitions; sample the Bézier like the canvas does if routes need it.
 */
export function exportWalkSheetsPdf(): void {
  const s = useEditor.getState();
  const ordered = byOrder(s.formations);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  s.performers.forEach((performer, pageIndex) => {
    if (pageIndex > 0) doc.addPage('a4', 'landscape');

    const stops = ordered.flatMap((f) => {
      const pos = s.positions[f.id]?.[performer.id];
      return pos !== undefined ? [{ formation: f, pos }] : [];
    });

    // Header: mark dot + name + role, performance title on the right.
    doc.setFillColor(performer.color);
    doc.circle(MARGIN + 3, MARGIN + 1, 3, 'F');
    const badge = pdfSafe(performer.badge ?? '');
    if (badge !== '') {
      doc.setFontSize(badge.length <= 1 ? 8 : 5);
      doc.setTextColor('#ffffff');
      doc.setFont('helvetica', 'bold');
      doc.text(badge, MARGIN + 3, MARGIN + 2.2, { align: 'center' });
    }
    doc.setTextColor(INK);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text(pdfSafe(performer.name) || `#${pageIndex + 1}`, MARGIN + 9, MARGIN + 3);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(DIM);
    if (performer.role !== '') doc.text(pdfSafe(performer.role), MARGIN + 9, MARGIN + 8);
    doc.text(pdfSafe(s.performance.title), PAGE_W - MARGIN, MARGIN + 3, { align: 'right' });

    // Stage plot, left side.
    const plotW = 168;
    const plotH = PAGE_H - MARGIN * 2 - HEADER_H;
    const scale = Math.min(plotW / s.performance.stageWidth, plotH / s.performance.stageHeight);
    const stageW = s.performance.stageWidth * scale;
    const stageH = s.performance.stageHeight * scale;
    const originX = MARGIN;
    const originY = MARGIN + HEADER_H + (plotH - stageH) / 2;

    doc.setDrawColor(INK);
    doc.setLineWidth(0.4);
    doc.rect(originX, originY, stageW, stageH);

    // 1-meter grid — same reference lines the editor canvas shows.
    doc.setLineWidth(0.1);
    doc.setDrawColor('#d8d2c8');
    for (let m = 1; m < s.performance.stageWidth; m++) {
      doc.line(originX + m * scale, originY, originX + m * scale, originY + stageH);
    }
    for (let m = 1; m < s.performance.stageHeight; m++) {
      doc.line(originX, originY + m * scale, originX + stageW, originY + m * scale);
    }

    doc.setLineWidth(0.15);
    doc.setDrawColor(DIM);
    doc.setLineDashPattern([1.5, 1.5], 0);
    doc.line(originX + stageW / 2, originY, originX + stageW / 2, originY + stageH);
    doc.setLineDashPattern([], 0);

    // Audience at the top = the plan rotated 180° (performer view).
    const flip = s.performance.audienceAt === 'top';
    const toPt = (pos: { x: number; y: number }): { x: number; y: number } => ({
      x: originX + (flip ? s.performance.stageWidth - pos.x : pos.x) * scale,
      y: originY + (flip ? s.performance.stageHeight - pos.y : pos.y) * scale,
    });
    doc.setFontSize(7);
    doc.setTextColor(DIM);
    doc.text('AUDIENCE', originX + stageW / 2, flip ? originY - 2.5 : originY + stageH + 5, {
      align: 'center',
    });

    // Route: dashed legs between consecutive stops, numbered circles on top.
    doc.setDrawColor(performer.color);
    doc.setLineWidth(0.4);
    doc.setLineDashPattern([2, 1.6], 0);
    for (let i = 0; i < stops.length - 1; i++) {
      const a = stops[i];
      const b = stops[i + 1];
      if (a === undefined || b === undefined) continue;
      const aPt = toPt(a.pos);
      const bPt = toPt(b.pos);
      doc.line(aPt.x, aPt.y, bPt.x, bPt.y);
    }
    doc.setLineDashPattern([], 0);
    stops.forEach((stop, i) => {
      const { x, y } = toPt(stop.pos);
      doc.setFillColor('#ffffff');
      doc.setDrawColor(performer.color);
      doc.setLineWidth(0.5);
      doc.circle(x, y, 3, 'FD');
      doc.setFontSize(7.5);
      doc.setTextColor(INK);
      doc.setFont('helvetica', 'bold');
      doc.text(String(i + 1), x, y + 1, { align: 'center' });
    });

    // Table, right side: # / formation / time / position / facing.
    const tableX = MARGIN + plotW + 10;
    const tableW = PAGE_W - MARGIN - tableX;
    const rowY = MARGIN + HEADER_H + 4;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(INK);
    doc.text('#', tableX, rowY);
    doc.text('Formation', tableX + 8, rowY);
    doc.text('Time', tableX + 44, rowY);
    doc.text('x,y (m)', tableX + 74, rowY);
    doc.text('Face', tableX + 92, rowY);
    doc.setLineWidth(0.2);
    doc.setDrawColor(DIM);
    doc.line(tableX, rowY + 1.5, tableX + tableW, rowY + 1.5);
    doc.setFont('helvetica', 'normal');

    const rowH = 5.4;
    const maxRows = Math.floor((PAGE_H - MARGIN - rowY - 6) / rowH);
    stops.slice(0, maxRows).forEach((stop, i) => {
      const y = rowY + 5 + i * rowH;
      const holdEnd = stop.formation.startTimeMs + stop.formation.durationMs;
      doc.setFontSize(8);
      doc.setTextColor(INK);
      doc.text(String(i + 1), tableX, y);
      doc.text(pdfSafe(stop.formation.name).slice(0, 20) || `(${i + 1})`, tableX + 8, y);
      doc.setTextColor(DIM);
      doc.text(
        `${formatTimecode(stop.formation.startTimeMs)}-${formatTimecode(holdEnd)}`,
        tableX + 44,
        y,
      );
      doc.setTextColor(INK);
      doc.text(`${stop.pos.x.toFixed(1)}, ${stop.pos.y.toFixed(1)}`, tableX + 74, y);
      doc.text(`${Math.round(stop.pos.rotation)}°`, tableX + 92, y);
    });
    if (stops.length > maxRows) {
      doc.setFontSize(7.5);
      doc.setTextColor(DIM);
      doc.text(`+${stops.length - maxRows} more…`, tableX, rowY + 5 + maxRows * rowH);
    }

    doc.setFontSize(7.5);
    doc.setTextColor(DIM);
    doc.text(`page ${pageIndex + 1}`, PAGE_W - MARGIN, PAGE_H - 7, { align: 'right' });
  });

  doc.save(`${safeFilename(s.performance.title)}-walk-sheets.pdf`);
}
