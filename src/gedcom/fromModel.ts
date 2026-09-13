/** Project -> GEDCOM 5.5.1 text (UTF-8). Preserved raw lines and records are written back. */
import type { Person, Project, Union } from '@/model/types';
import { formatGedcomDate } from './dates';
import { lineFor } from './parse';
import type { ExportReport } from './report';

export interface ExportOptions {
  /** Whether to write preserved raw data (person/family lines and top-level records). */
  preserve: boolean;
  sourceName: string;
  sourceVersion: string;
  now?: Date;
}

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

export function exportGedcom(project: Project, options: ExportOptions): { text: string; report: ExportReport } {
  const persons = Object.values(project.persons);
  const unions = Object.values(project.unions);
  const report: ExportReport = { individuals: persons.length, families: unions.length, preserved: options.preserve, preservedRecords: 0, preservedLines: 0, notes: [] };
  const note = (n: ExportReport['notes'][number]) => {
    if (!report.notes.includes(n)) report.notes.push(n);
  };

  // Cross-reference ids: keep imported ones when unique, otherwise generate.
  const used = new Set<string>();
  const xrefOf = new Map<string, string>();
  const assign = (id: string, wanted: string | undefined, prefix: string, counter: { n: number }) => {
    let x = wanted && !used.has(wanted) ? wanted : '';
    while (!x || used.has(x)) x = `@${prefix}${++counter.n}@`;
    used.add(x);
    xrefOf.set(id, x);
  };
  const ic = { n: 0 }, fc = { n: 0 };
  for (const p of persons) if (p.gedcomXref) assign(p.id, p.gedcomXref, 'I', ic);
  for (const p of persons) if (!xrefOf.has(p.id)) assign(p.id, undefined, 'I', ic);
  for (const u of unions) if (u.gedcomXref) assign(u.id, u.gedcomXref, 'F', fc);
  for (const u of unions) if (!xrefOf.has(u.id)) assign(u.id, undefined, 'F', fc);

  const out: string[] = [];
  const push = (level: number, tag: string, value = '', xref: string | null = null) => out.push(...lineFor(level, xref, tag, value));
  const now = options.now ?? new Date();
  const hasSubm = options.preserve && project.rawRecords.some((r) => /^0 @[^@]+@ SUBM\b/.test(r));

  push(0, 'HEAD');
  push(1, 'SOUR', options.sourceName.toUpperCase().replace(/\s+/g, '_'));
  push(2, 'VERS', options.sourceVersion);
  push(2, 'NAME', options.sourceName);
  push(1, 'DEST', 'ANY');
  push(1, 'DATE', `${now.getUTCDate()} ${MONTHS[now.getUTCMonth()]} ${now.getUTCFullYear()}`);
  push(1, 'SUBM', '@SUBM1@');
  push(1, 'GEDC');
  push(2, 'VERS', '5.5.1');
  push(2, 'FORM', 'LINEAGE-LINKED');
  push(1, 'CHAR', 'UTF-8');
  if (project.name) push(1, 'NOTE', project.name);
  if (!hasSubm) {
    push(0, 'SUBM', '', '@SUBM1@');
    push(1, 'NAME', 'Unknown');
  }

  const dateLine = (level: number, date: string | null, qualifier: Person['birth']['qualifier'], verbatim: string | undefined) => {
    const d = formatGedcomDate(date, qualifier, verbatim);
    if (verbatim) note('rangesVerbatim');
    if (d) push(level, 'DATE', d);
  };

  const famsOf = new Map<string, string[]>();
  const famcOf = new Map<string, string[]>();
  for (const u of unions) for (const pid of u.partnerIds) famsOf.set(pid, [...(famsOf.get(pid) ?? []), xrefOf.get(u.id)!]);
  const relOf = new Map<string, string>();
  for (const l of Object.values(project.childLinks)) {
    const fx = xrefOf.get(l.unionId);
    if (!fx || !project.persons[l.childId]) continue;
    famcOf.set(l.childId, [...(famcOf.get(l.childId) ?? []), fx]);
    relOf.set(`${l.childId}|${fx}`, l.relationType);
  }

  for (const p of persons) {
    const rawBlocks = options.preserve ? splitBlocks(p.rawGedcom) : [];
    /** Emit the children of the first preserved raw block with this header tag, once. */
    const rawUnder = (tag: string) => {
      const i = rawBlocks.findIndex((b) => b.tag === tag && !b.used);
      if (i < 0) return;
      rawBlocks[i]!.used = true;
      out.push(...rawBlocks[i]!.lines.slice(1));
      report.preservedLines += rawBlocks[i]!.lines.length - 1;
    };
    push(0, 'INDI', '', xrefOf.get(p.id));
    const surnameForName = p.birthName || p.surname;
    push(1, 'NAME', `${p.givenNames} /${surnameForName}/`.trim());
    if (p.titlePrefix) push(2, 'NPFX', p.titlePrefix);
    if (p.givenNames) push(2, 'GIVN', p.givenNames);
    if (p.nickname) push(2, 'NICK', p.nickname);
    if (surnameForName) push(2, 'SURN', surnameForName);
    if (p.birthName && p.surname && p.surname !== p.birthName) push(2, '_MARNM', p.surname);
    if (p.sex === 'male') push(1, 'SEX', 'M');
    else if (p.sex === 'female') push(1, 'SEX', 'F');
    else if (p.sex === 'diverse') {
      push(1, 'SEX', 'X');
      push(1, '_GENDER', 'diverse');
      note('diverseAsX');
    }
    if (p.birth.date || p.birth.place || p.birth.note || p.birth.gedcomDate) {
      push(1, 'BIRT');
      dateLine(2, p.birth.date, p.birth.qualifier, p.birth.gedcomDate);
      if (p.birth.place) push(2, 'PLAC', p.birth.place);
      if (p.birth.note) push(2, 'NOTE', p.birth.note);
      rawUnder('BIRT');
    }
    const deathHasData = !!(p.death.date || p.death.place || p.death.note || p.death.cause || p.death.gedcomDate);
    if (deathHasData) {
      push(1, 'DEAT');
      dateLine(2, p.death.date, p.death.qualifier, p.death.gedcomDate);
      if (p.death.place) push(2, 'PLAC', p.death.place);
      if (p.death.cause) push(2, 'CAUS', p.death.cause);
      if (p.death.note) push(2, 'NOTE', p.death.note);
      rawUnder('DEAT');
    } else if (p.lifeStatus === 'deceased') {
      push(1, 'DEAT', 'Y');
      rawUnder('DEAT');
    }
    for (const e of p.events) {
      const tag = e.type === 'baptism' ? 'BAPM' : e.type === 'burial' ? 'BURI' : e.type === 'residence' ? 'RESI' : e.type === 'emigration' ? 'EMIG' : 'EVEN';
      push(1, tag, e.type === 'residence' ? e.label : '');
      if (e.type === 'other' && e.label) push(2, 'TYPE', e.label);
      dateLine(2, e.date, e.qualifier, e.gedcomDate);
      if (e.place) push(2, 'PLAC', e.place);
      if (e.note) push(2, 'NOTE', e.note);
      rawUnder(tag);
    }
    if (p.occupation) push(1, 'OCCU', p.occupation);
    if (p.religion) push(1, 'RELI', p.religion);
    if (p.residence) push(1, 'RESI', p.residence);
    if (p.notes) push(1, 'NOTE', p.notes);
    if (p.sources) for (const s of p.sources.split('\n').filter(Boolean)) push(1, 'SOUR', s);
    for (const f of p.customFields) {
      push(1, '_UDF', f.label);
      push(2, 'TEXT', f.value);
      note('customFieldsAsUdf');
    }
    for (const fx of famsOf.get(p.id) ?? []) push(1, 'FAMS', fx);
    for (const fx of famcOf.get(p.id) ?? []) {
      push(1, 'FAMC', fx);
      const rel = relOf.get(`${p.id}|${fx}`);
      if (rel && rel !== 'biological' && rel !== 'unknown') push(2, 'PEDI', rel);
    }
    for (const b of rawBlocks) {
      if (b.used) continue;
      out.push(...b.lines);
      report.preservedLines += b.lines.length;
    }
  }

  for (const u of unions) {
    push(0, 'FAM', '', xrefOf.get(u.id));
    const [a, b] = partnerRoles(u, project, note);
    if (a) push(1, 'HUSB', xrefOf.get(a));
    if (b) push(1, 'WIFE', xrefOf.get(b));
    for (const l of Object.values(project.childLinks)) if (l.unionId === u.id && xrefOf.has(l.childId)) push(1, 'CHIL', xrefOf.get(l.childId));
    if (u.type === 'marriage' || u.type === 'partnership' || u.marriageDate || u.marriagePlace || u.marriageGedcomDate) {
      push(1, 'MARR');
      dateLine(2, u.marriageDate, u.marriageQualifier, u.marriageGedcomDate);
      if (u.marriagePlace) push(2, 'PLAC', u.marriagePlace);
      if (u.type === 'partnership') push(2, 'TYPE', 'partnership');
    }
    if (u.divorceDate || u.divorceGedcomDate) {
      push(1, 'DIV');
      dateLine(2, u.divorceDate, u.divorceQualifier, u.divorceGedcomDate);
    } else if (u.status === 'divorced') push(1, 'DIV', 'Y');
    if (u.type === 'unmarried') push(1, '_STAT', 'unmarried');
    else if (u.status === 'separated') push(1, '_STAT', 'separated');
    else if (u.status === 'widowed') push(1, '_STAT', 'widowed');
    if (u.notes) push(1, 'NOTE', u.notes);
    if (options.preserve && u.rawGedcom.length) {
      out.push(...u.rawGedcom.flatMap((l) => l.split('\n')));
      report.preservedLines += u.rawGedcom.length;
    }
  }

  if (options.preserve) {
    for (const r of project.rawRecords) {
      out.push(...r.split('\n'));
      report.preservedRecords++;
      report.preservedLines += r.split('\n').length;
    }
  } else if (project.rawRecords.length || persons.some((p) => p.rawGedcom.length) || unions.some((u) => u.rawGedcom.length)) note('preservationOff');
  push(0, 'TRLR');
  return { text: out.join('\r\n') + '\r\n', report };
}

/** Group preserved raw lines into blocks starting at level 1. */
function splitBlocks(raw: string[]): { tag: string; lines: string[]; used: boolean }[] {
  const blocks: { tag: string; lines: string[]; used: boolean }[] = [];
  for (const line of raw.flatMap((l) => l.split('\n'))) {
    const m = line.match(/^(\d+)\s+(?:@[^@]+@\s+)?([A-Za-z0-9_]+)/);
    if (m && m[1] === '1') blocks.push({ tag: m[2]!.toUpperCase(), lines: [line], used: false });
    else if (blocks.length) blocks[blocks.length - 1]!.lines.push(line);
    else blocks.push({ tag: '', lines: [line], used: false });
  }
  return blocks;
}

/** HUSB/WIFE by sex where possible; otherwise by order (and a note for same-sex couples). */
function partnerRoles(u: Union, project: Project, note: (n: ExportReport['notes'][number]) => void): [string | null, string | null] {
  const ids = u.partnerIds.filter((id) => project.persons[id]);
  if (ids.length === 0) return [null, null];
  if (ids.length === 1) {
    const p = project.persons[ids[0]!]!;
    return p.sex === 'female' ? [null, ids[0]!] : [ids[0]!, null];
  }
  const [x, y] = ids as [string, string];
  const sx = project.persons[x]!.sex, sy = project.persons[y]!.sex;
  if (sx === 'female' && sy !== 'female') return [y, x];
  if (sy === 'female' && sx !== 'female') return [x, y];
  if (sx === sy && (sx === 'male' || sx === 'female')) note('sameSexAsHusbWife');
  return [x, y];
}
