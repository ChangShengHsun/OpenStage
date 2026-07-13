import { jsPDF } from 'jspdf';
import { useEditor } from '../state/store';
import { byOrder, formatTimecode } from '../state/interpolate';
import { safeFilename } from './filename';

// A4 landscape, millimeters.
const PAGE_W = 297;
const PAGE_H = 210;
const MARGIN = 18;
const HEADER_H = 16;

const INK = '#26221e';
const DIM = '#8a8074';

/**
 * Walk chart: one page per formation (stage plan with marks, facing arrows
 * and names) plus a roster page. Drawn as vectors — crisp at any print size.
 */
export function exportPerformancePdf(): void {
  const s = useEditor.getState();
  const ordered = byOrder(s.formations);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  drawRosterPage(doc, s.performance.title);

  ordered.forEach((formation, index) => {
    doc.addPage('a4', 'landscape');
    const positions = s.positions[formation.id] ?? {};

    // Header
    doc.setTextColor(INK);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(`${index + 1}. ${formation.name}`, MARGIN, MARGIN);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(DIM);
    const holdEnd = formation.startTimeMs + formation.durationMs;
    doc.text(
      `${formatTimecode(formation.startTimeMs)} – ${formatTimecode(holdEnd)}   ·   transition out: ${formation.transitionType}`,
      MARGIN,
      MARGIN + 5,
    );
    doc.text(s.performance.title, PAGE_W - MARGIN, MARGIN, { align: 'right' });

    // Stage box, meters -> mm
    const availW = PAGE_W - MARGIN * 2;
    const availH = PAGE_H - MARGIN * 2 - HEADER_H - 8;
    const scale = Math.min(availW / s.performance.stageWidth, availH / s.performance.stageHeight);
    const stageW = s.performance.stageWidth * scale;
    const stageH = s.performance.stageHeight * scale;
    const originX = (PAGE_W - stageW) / 2;
    const originY = MARGIN + HEADER_H;

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

    // Center line
    doc.setLineWidth(0.15);
    doc.setDrawColor(DIM);
    doc.setLineDashPattern([1.5, 1.5], 0);
    doc.line(originX + stageW / 2, originY, originX + stageW / 2, originY + stageH);
    doc.setLineDashPattern([], 0);

    // Audience at the top = the plan rotated 180° (performer view).
    const flip = s.performance.audienceAt === 'top';
    doc.setFontSize(8);
    doc.setTextColor(DIM);
    doc.text('AUDIENCE', PAGE_W / 2, flip ? originY - 3 : originY + stageH + 6, {
      align: 'center',
    });

    // Marks
    for (const performer of s.performers) {
      const pos = positions[performer.id];
      if (pos === undefined) continue;
      const x = originX + (flip ? s.performance.stageWidth - pos.x : pos.x) * scale;
      const y = originY + (flip ? s.performance.stageHeight - pos.y : pos.y) * scale;
      const arm = 1.8;

      doc.setDrawColor(performer.color);
      doc.setLineWidth(0.7);
      doc.line(x - arm, y - arm, x + arm, y + arm);
      doc.line(x - arm, y + arm, x + arm, y - arm);

      // Facing arrow: rotation 0 = toward audience (page-down; page-up when
      // flipped), clockwise.
      const angleRad = ((pos.rotation + (flip ? 270 : 90)) * Math.PI) / 180;
      const dirX = Math.cos(angleRad);
      const dirY = Math.sin(angleRad);
      const tipX = x + dirX * 6;
      const tipY = y + dirY * 6;
      doc.setLineWidth(0.35);
      doc.line(x + dirX * 2.4, y + dirY * 2.4, tipX, tipY);
      const headAngle = Math.PI / 7;
      const headLen = 1.6;
      doc.line(
        tipX,
        tipY,
        tipX - headLen * Math.cos(angleRad - headAngle),
        tipY - headLen * Math.sin(angleRad - headAngle),
      );
      doc.line(
        tipX,
        tipY,
        tipX - headLen * Math.cos(angleRad + headAngle),
        tipY - headLen * Math.sin(angleRad + headAngle),
      );

      doc.setFontSize(8);
      doc.setTextColor(INK);
      doc.text(performer.name, x, y + arm + 3.5, { align: 'center' });
    }

    doc.setFontSize(8);
    doc.setTextColor(DIM);
    doc.text(`page ${index + 2}`, PAGE_W - MARGIN, PAGE_H - 8, { align: 'right' });
  });

  doc.save(`${safeFilename(s.performance.title)}-walk-charts.pdf`);
}

function drawRosterPage(doc: jsPDF, title: string): void {
  const s = useEditor.getState();

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(INK);
  doc.text(title, MARGIN, MARGIN + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(DIM);
  doc.text(
    `${s.performers.length} performers · ${s.formations.length} formations · stage ${s.performance.stageWidth}m × ${s.performance.stageHeight}m`,
    MARGIN,
    MARGIN + 13,
  );

  doc.setFontSize(11);
  doc.setTextColor(INK);
  doc.text('Roster', MARGIN, MARGIN + 26);
  doc.setLineWidth(0.2);
  doc.setDrawColor(DIM);
  doc.line(MARGIN, MARGIN + 28, PAGE_W - MARGIN, MARGIN + 28);

  const rowH = 7;
  const colW = (PAGE_W - MARGIN * 2) / 2;
  const rowsPerCol = Math.floor((PAGE_H - (MARGIN + 34) - MARGIN) / rowH);

  s.performers.forEach((p, i) => {
    const col = Math.floor(i / rowsPerCol);
    const row = i % rowsPerCol;
    const x = MARGIN + col * colW;
    const y = MARGIN + 34 + row * rowH;
    doc.setFillColor(p.color);
    doc.circle(x + 2, y - 1.2, 1.6, 'F');
    doc.setFontSize(10);
    doc.setTextColor(INK);
    doc.text(p.name, x + 7, y);
    if (p.role !== '') {
      doc.setTextColor(DIM);
      doc.text(p.role, x + 7 + doc.getTextWidth(p.name) + 4, y);
    }
  });

  doc.setFontSize(8);
  doc.setTextColor(DIM);
  doc.text('page 1', PAGE_W - MARGIN, PAGE_H - 8, { align: 'right' });
}
