/**
 * Roster CSV parsing. Expected columns: name[,role[,color]].
 * A header row (any cell equal to "name", case-insensitive) is skipped.
 * Quoted fields with commas/escaped quotes ("" -> ") are supported —
 * enough RFC 4180 for spreadsheet exports; multiline fields are not.
 */

export interface RosterRow {
  name: string;
  role: string;
  /** Hex like #aabbcc when the file provides a valid one, otherwise null. */
  color: string | null;
}

const HEX_COLOR = /^#?[0-9a-fA-F]{6}$/;

/** Split one CSV line honoring double quotes. */
function splitLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      cells.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current);
  return cells.map((c) => c.trim());
}

export function parseRoster(text: string): RosterRow[] {
  const lines = text.split(/\r\n|\r|\n/).filter((l) => l.trim() !== '');
  const rows: RosterRow[] = [];
  for (const [index, line] of lines.entries()) {
    const cells = splitLine(line);
    const name = cells[0] ?? '';
    if (name === '') continue;
    if (index === 0 && cells.some((c) => c.toLowerCase() === 'name')) continue; // header
    const rawColor = (cells[2] ?? '').trim();
    rows.push({
      name,
      role: cells[1] ?? '',
      color: HEX_COLOR.test(rawColor) ? `#${rawColor.replace('#', '').toLowerCase()}` : null,
    });
  }
  return rows;
}
