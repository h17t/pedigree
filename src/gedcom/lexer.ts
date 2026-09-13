/**
 * GEDCOM line lexer. Tolerates CR, LF and CRLF, a BOM, leading whitespace, over-long lines,
 * and joins CONC/CONT continuation lines into the value of the preceding line.
 */
export interface GedLine {
  level: number;
  xref: string | null;
  tag: string;
  value: string;
  /** 1-based line number of the first physical line. */
  line: number;
}

export interface LexResult {
  lines: GedLine[];
  problems: { line: number; text: string; message: string }[];
}

const LINE_RE = /^\s*(\d{1,2})\s+(?:(@[^@]+@)\s+)?([A-Za-z0-9_]+)(?:\s(.*))?$/;

export function lex(text: string): LexResult {
  const out: GedLine[] = [];
  const problems: LexResult['problems'] = [];
  const raw = text.replace(/^\uFEFF/, '').split(/\r\n|\r|\n/);
  for (let i = 0; i < raw.length; i++) {
    const physical = raw[i]!;
    if (physical.trim() === '') continue;
    const m = physical.match(LINE_RE);
    if (!m) {
      problems.push({ line: i + 1, text: physical.slice(0, 80), message: 'unparseable' });
      continue;
    }
    const level = Number(m[1]);
    const tag = m[3]!.toUpperCase();
    const value = m[4] ?? '';
    const prev = out[out.length - 1];
    if ((tag === 'CONC' || tag === 'CONT') && prev && level === prev.level + 1 && !m[2]) {
      prev.value += tag === 'CONT' ? `\n${value}` : value;
      continue;
    }
    if (prev && level > prev.level + 1) {
      problems.push({ line: i + 1, text: physical.slice(0, 80), message: 'level jump' });
    }
    out.push({ level, xref: m[2] ?? null, tag, value, line: i + 1 });
  }
  return { lines: out, problems };
}
