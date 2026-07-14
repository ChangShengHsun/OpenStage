import type { jsPDF } from 'jspdf';
// Noto Sans TC subset (Big5 hanzi + Latin + CJK punctuation), SIL OFL —
// see NotoSansTC-OFL.txt next to the font. Fetched only when a PDF export
// actually contains CJK text (~4.8MB asset).
import fontUrl from '../assets/NotoSansTC-subset.ttf?url';

export const CJK_FONT = 'NotoSansTC';
const VFS_NAME = 'NotoSansTC-subset.ttf';

/** Does the text contain CJK ideographs, kana, or fullwidth punctuation? */
export function hasCjk(text: string): boolean {
  return /[\u2E80-\u9FFF\uF900-\uFAFF\u3000-\u303F\uFF00-\uFFEF]/.test(text);
}

let fontBase64: string | null = null;

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const CHUNK = 0x8000; // avoid call-stack limits on fromCharCode
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

/**
 * Register the bundled Traditional Chinese font on a jsPDF doc and return
 * its family name; `needed` false skips the download and keeps helvetica.
 * The single 400-weight file is registered as both 'normal' and 'bold'
 * (ponytail: no real bold cut — add a 700 instance if headings need it).
 */
export async function ensureCjkFont(doc: jsPDF, needed: boolean): Promise<string> {
  if (!needed) return 'helvetica';
  if (fontBase64 === null) {
    const response = await fetch(fontUrl);
    fontBase64 = toBase64(await response.arrayBuffer());
  }
  doc.addFileToVFS(VFS_NAME, fontBase64);
  doc.addFont(VFS_NAME, CJK_FONT, 'normal');
  doc.addFont(VFS_NAME, CJK_FONT, 'bold');
  return CJK_FONT;
}
