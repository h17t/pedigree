/** Builds a tree of records from lexed lines. */
import { lex } from './lexer';
import type { GedLine, LexResult } from './lexer';

export interface GedNode {
  level: number;
  xref: string | null;
  tag: string;
  value: string;
  children: GedNode[];
  line: number;
}

export interface GedFile {
  records: GedNode[];
  problems: LexResult['problems'];
  /** Raw text lines by record, for verbatim preservation. */
}

export function parseGedcom(text: string): GedFile {
  const { lines, problems } = lex(text);
  const records: GedNode[] = [];
  const stack: GedNode[] = [];
  for (const l of lines) {
    const node: GedNode = { level: l.level, xref: l.xref, tag: l.tag, value: l.value, children: [], line: l.line };
    if (l.level === 0) {
      records.push(node);
      stack.length = 0;
      stack.push(node);
      continue;
    }
    // Find the parent: the nearest node with level - 1 (tolerating level jumps).
    while (stack.length && stack[stack.length - 1]!.level >= l.level) stack.pop();
    const parent = stack[stack.length - 1];
    if (!parent) {
      problems.push({ line: l.line, text: `${l.level} ${l.tag}`, message: 'orphan line' });
      continue;
    }
    parent.children.push(node);
    stack.push(node);
  }
  return { records, problems };
}

export function child(node: GedNode, tag: string): GedNode | undefined {
  return node.children.find((c) => c.tag === tag);
}
export function children(node: GedNode, tag: string): GedNode[] {
  return node.children.filter((c) => c.tag === tag);
}
export function valueOf(node: GedNode | undefined, tag: string): string {
  return node ? (child(node, tag)?.value ?? '') : '';
}

/** Serialise a node subtree back to GEDCOM lines (used for verbatim preservation). */
export function nodeToLines(node: GedNode, levelOffset = 0): string[] {
  const out: string[] = [];
  const walk = (n: GedNode) => {
    out.push(...lineFor(n.level + levelOffset, n.xref, n.tag, n.value));
    for (const c of n.children) walk(c);
  };
  walk(node);
  return out;
}

const MAX = 248;
/** One logical line → physical lines with CONT for newlines and CONC for length. */
export function lineFor(level: number, xref: string | null, tag: string, value: string): string[] {
  const head = xref ? `${level} ${xref} ${tag}` : `${level} ${tag}`;
  const parts = value.split('\n');
  const out: string[] = [];
  parts.forEach((part, i) => {
    let rest = part;
    let first = true;
    do {
      const chunk = rest.slice(0, MAX);
      rest = rest.slice(MAX);
      if (i === 0 && first) out.push(chunk ? `${head} ${chunk}` : head);
      else if (first) out.push(`${level + 1} CONT ${chunk}`.trimEnd());
      else out.push(`${level + 1} CONC ${chunk}`);
      first = false;
    } while (rest.length > 0);
  });
  return out;
}

export { lex };
export type { GedLine };
