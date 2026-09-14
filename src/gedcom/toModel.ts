/**
 * GEDCOM records -> project. Known tags are mapped; everything else is preserved verbatim on
 * the person/union (`rawGedcom`) or, for unreferenced top-level records, on the project.
 */
import type { DeathDate, EventDate, LifeEvent, Person, Project, RelationType, Union } from '@/model/types';
import { createChildLink, createPerson, createProject, createUnion, newId } from '@/model/types';
import { validateProject } from '@/model/validation';
import { decodeGedcom } from './decode';
import { parseGedcomDate } from './dates';
import { parseGedcom, child, children, nodeToLines, valueOf } from './parse';
import type { GedNode } from './parse';
import type { ImportReport } from './report';

export type ImportResult = { ok: true; project: Project; report: ImportReport } | { ok: false; reason: 'empty' | 'unreadable' };

const PERSON_TAGS = new Set(['NAME', 'SEX', 'BIRT', 'DEAT', 'BAPM', 'CHR', 'BURI', 'RESI', 'EMIG', 'OCCU', 'RELI', 'NOTE', 'SNOTE', 'SOUR', 'FAMS', 'FAMC', '_UDF', '_GENDER']);
const FAMILY_TAGS = new Set(['HUSB', 'WIFE', 'CHIL', 'MARR', 'DIV', 'NOTE', 'SNOTE', '_STAT', '_STATUS']);

function nameParts(name: string): { given: string; surname: string; suffix: string } {
  const m = name.match(/^([^/]*)\/([^/]*)\/(.*)$/);
  if (!m) return { given: name.trim(), surname: '', suffix: '' };
  return { given: m[1]!.trim(), surname: m[2]!.trim(), suffix: m[3]!.trim() };
}

function label(p: Pick<Person, 'givenNames' | 'surname'>): string {
  return `${p.givenNames} ${p.surname}`.trim() || '?';
}

const isRef = (v: string) => /^@[^@]+@$/.test(v.trim());
/** GEDCOM 7 writes @VOID@ for a pointer that deliberately points nowhere. */
const isVoid = (v: string) => v.trim().toUpperCase() === '@VOID@';
/** NOTE and SNOTE (GEDCOM 7 shared note pointer) children of a node. */
const noteNodes = (n: GedNode) => n.children.filter((c) => c.tag === 'NOTE' || c.tag === 'SNOTE');

export function importGedcomText(text: string, options: { preserve: boolean; declared?: string | null; detected?: ImportReport['encodingDetected']; mismatch?: boolean } = { preserve: true }): ImportResult {
  const file = parseGedcom(text);
  if (file.records.length === 0) return { ok: false, reason: 'empty' };
  const head = file.records.find((r) => r.tag === 'HEAD');
  const gedc = head ? child(head, 'GEDC') : undefined;
  const version = gedc ? valueOf(gedc, 'VERS') : '';
  const isV7 = /^7(\.|$)/.test(version.trim());
  const sourceProgram = head ? valueOf(head, 'SOUR') || null : null;

  const report: ImportReport = {
    individuals: 0,
    families: 0,
    childLinks: 0,
    encodingDeclared: options.declared ?? (head ? valueOf(head, 'CHAR') || null : null),
    encodingDetected: options.detected ?? 'utf-8',
    encodingMismatch: options.mismatch ?? false,
    gedcomVersion: version || null,
    sourceProgram,
    ignoredTags: {},
    preservedRecords: 0,
    preservedLines: 0,
    uncertainDates: [],
    problems: file.problems.map((p) => `${p.line}: ${p.message} (${p.text})`),
    danglingReferences: 0,
    warnings: [],
    notes: [],
  };
  const ignore = (tag: string) => {
    report.ignoredTags[tag] = (report.ignoredTags[tag] ?? 0) + 1;
  };
  const noteOnce = (n: ImportReport['notes'][number]) => {
    if (!report.notes.includes(n)) report.notes.push(n);
  };

  if (isV7) noteOnce('gedcom7');

  const project = createProject('');
  project.settings.preserveRawGedcom = options.preserve;
  const noteRecords = new Map<string, string>();
  for (const r of file.records) if ((r.tag === 'NOTE' || r.tag === 'SNOTE') && r.xref) noteRecords.set(r.xref, r.value);
  const referencedNotes = new Set<string>();

  const resolveNote = (n: GedNode): string => {
    if (isRef(n.value)) {
      referencedNotes.add(n.value.trim());
      noteOnce('noteRecordsInlined');
      return noteRecords.get(n.value.trim()) ?? '';
    }
    return n.value;
  };

  /** Children of an event node that are not mapped (e.g. SOUR citations) go to the raw lines. */
  const eventExtras = (n: GedNode, raw: string[]) => {
    for (const c of n.children) {
      if (['DATE', 'PLAC', 'NOTE', 'SNOTE', 'CAUS', 'TYPE'].includes(c.tag)) continue;
      ignore(c.tag);
      raw.push(...nodeToLines({ ...n, children: [c] }));
    }
  };

  const eventDate = (n: GedNode | undefined, where: string, raw: string[]): EventDate => {
    const e: EventDate = { date: null, qualifier: 'exact', place: '', note: '' };
    if (!n) return e;
    const dv = valueOf(n, 'DATE');
    if (dv) {
      const d = parseGedcomDate(dv);
      e.date = d.date;
      e.qualifier = d.qualifier;
      if (d.dateEnd !== undefined) e.dateEnd = d.dateEnd;
      if (d.gedcomDate) e.gedcomDate = d.gedcomDate;
      if (d.uncertain) report.uncertainDates.push({ where, value: dv, interpretedAs: d.date ? `${d.qualifier} ${d.date}${d.dateEnd ? ` \u2013 ${d.dateEnd}` : ''}` : '-' });
    }
    e.place = valueOf(n, 'PLAC');
    const nn = noteNodes(n)[0];
    if (nn) e.note = resolveNote(nn);
    eventExtras(n, raw);
    return e;
  };

  const persons = new Map<string, Person>();

  for (const rec of file.records) {
    if (rec.tag !== 'INDI') continue;
    const p = createPerson();
    const raw: string[] = [];
    if (rec.xref) p.gedcomXref = rec.xref;
    const names = children(rec, 'NAME');
    const name = names[0];
    if (names.length > 1) noteOnce('multipleNames');
    if (name) {
      const parts = nameParts(name.value);
      p.givenNames = valueOf(name, 'GIVN') || parts.given;
      p.surname = valueOf(name, 'SURN') || parts.surname;
      p.nickname = valueOf(name, 'NICK');
      p.titlePrefix = valueOf(name, 'NPFX');
      const marnm = valueOf(name, '_MARNM');
      if (marnm) {
        noteOnce('marnmAsSurname');
        p.birthName = p.surname;
        p.surname = marnm;
      }
    }
    const sex = valueOf(rec, 'SEX').toUpperCase();
    const gender = valueOf(rec, '_GENDER').toLowerCase();
    p.sex = sex === 'M' ? 'male' : sex === 'F' ? 'female' : sex === 'X' || gender === 'diverse' ? 'diverse' : 'unknown';
    if (sex === 'X') noteOnce('sexXAsDiverse');
    const who = label(p);
    p.birth = eventDate(child(rec, 'BIRT'), `${who}: BIRT`, raw);
    const deat = child(rec, 'DEAT');
    const death = eventDate(deat, `${who}: DEAT`, raw) as DeathDate;
    death.cause = deat ? valueOf(deat, 'CAUS') : '';
    p.death = death;
    p.lifeStatus = deat ? 'deceased' : 'unknown';
    p.occupation = valueOf(rec, 'OCCU');
    p.religion = valueOf(rec, 'RELI');
    const resiNodes = children(rec, 'RESI');
    const EVENT_TYPES: Record<string, LifeEvent['type']> = { BAPM: 'baptism', CHR: 'baptism', BURI: 'burial', RESI: 'residence', EMIG: 'emigration' };
    // Events in document order, so a round trip keeps the order the user sees.
    for (const n of rec.children) {
      const type = EVENT_TYPES[n.tag];
      if (!type) continue;
      const d = eventDate(n, `${who}: ${n.tag}`, raw);
      const ev: LifeEvent = { id: newId(), type, label: type === 'residence' && n.value ? n.value : '', date: d.date, qualifier: d.qualifier, place: d.place, note: d.note };
      if (d.dateEnd !== undefined) ev.dateEnd = d.dateEnd;
      if (d.gedcomDate) ev.gedcomDate = d.gedcomDate;
      p.events.push(ev);
    }
    if (resiNodes.length === 1 && !resiNodes[0]!.children.some((c) => c.tag === 'DATE')) {
      // A single undated RESI is the current residence.
      p.residence = resiNodes[0]!.value || valueOf(resiNodes[0], 'PLAC');
      p.events = p.events.filter((e) => e.type !== 'residence');
    }
    for (const n of noteNodes(rec)) p.notes = [p.notes, resolveNote(n)].filter(Boolean).join('\n');
    const sourceTexts: string[] = [];
    for (const n of children(rec, 'SOUR')) {
      if (isRef(n.value)) continue;
      sourceTexts.push([n.value, valueOf(n, 'PAGE'), valueOf(n, 'TEXT')].filter(Boolean).join(' - '));
    }
    p.sources = sourceTexts.join('\n');
    for (const n of children(rec, '_UDF')) p.customFields.push({ label: n.value, value: valueOf(n, 'TEXT') });
    // Everything unmapped: unknown tags, source citations by reference, extra NAME records.
    for (const c of rec.children) {
      const mapped = PERSON_TAGS.has(c.tag) && !(c.tag === 'SOUR' && isRef(c.value)) && !(c.tag === 'NAME' && c !== name) && !(c.tag === 'BIRT' && c !== child(rec, 'BIRT')) && !(c.tag === 'DEAT' && c !== deat);
      if (mapped) continue;
      ignore(c.tag);
      raw.push(...nodeToLines(c));
    }
    p.rawGedcom = options.preserve ? raw : [];
    const key = rec.xref ?? newId();
    // Two records sharing one id: the second would take over every FAMS/FAMC/CHIL pointer and
    // the first would silently lose its family, so the import says so.
    if (rec.xref && persons.has(rec.xref)) report.problems.push(`${rec.line}: duplicate record id ${rec.xref}`);
    persons.set(key, p);
    project.persons[p.id] = p;
    report.individuals++;
  }

  // PEDI (relation type) lives on the child's FAMC.
  const pedi = new Map<string, RelationType>();
  for (const rec of file.records) {
    if (rec.tag !== 'INDI' || !rec.xref) continue;
    for (const famc of children(rec, 'FAMC')) {
      const v = valueOf(famc, 'PEDI').toLowerCase();
      const rel: RelationType = v === 'adopted' ? 'adopted' : v === 'foster' ? 'foster' : v === 'step' ? 'step' : v === 'birth' || v === '' ? 'biological' : 'unknown';
      pedi.set(`${famc.value.trim()}|${rec.xref}`, rel);
    }
  }

  for (const rec of file.records) {
    if (rec.tag !== 'FAM') continue;
    const u: Union = createUnion();
    const raw: string[] = [];
    if (rec.xref) u.gedcomXref = rec.xref;
    const partners = [valueOf(rec, 'HUSB'), valueOf(rec, 'WIFE')].map((x) => x.trim()).filter((x) => x && !isVoid(x));
    for (const x of partners) {
      const p = persons.get(x);
      if (p) u.partnerIds.push(p.id);
      else report.danglingReferences++;
    }
    const marr = child(rec, 'MARR');
    if (marr) {
      const d = eventDate(marr, `FAM ${rec.xref ?? ''}: MARR`, raw);
      u.marriageDate = d.date;
      u.marriageQualifier = d.qualifier;
      if (d.gedcomDate) u.marriageGedcomDate = d.gedcomDate;
      u.marriagePlace = d.place;
      const type = valueOf(marr, 'TYPE').toLowerCase();
      const partnership = /partner|civil|registered/.test(type);
      u.type = partnership ? 'partnership' : 'marriage';
      u.status = partnership ? 'partnership' : 'married';
    } else {
      u.type = 'unknown';
      u.status = 'unknown';
    }
    const div = child(rec, 'DIV');
    if (div) {
      const d = eventDate(div, `FAM ${rec.xref ?? ''}: DIV`, raw);
      u.divorceDate = d.date;
      u.divorceQualifier = d.qualifier;
      if (d.gedcomDate) u.divorceGedcomDate = d.gedcomDate;
      u.status = 'divorced';
    }
    const stat = (valueOf(rec, '_STAT') || valueOf(rec, '_STATUS')).toLowerCase();
    if (/unmarried|not married/.test(stat)) {
      u.type = 'unmarried';
      u.status = 'partnership';
    } else if (/separat/.test(stat)) u.status = 'separated';
    else if (/widow/.test(stat)) u.status = 'widowed';
    for (const n of noteNodes(rec)) u.notes = [u.notes, resolveNote(n)].filter(Boolean).join('\n');
    for (const c of rec.children) {
      if (FAMILY_TAGS.has(c.tag)) continue;
      ignore(c.tag);
      raw.push(...nodeToLines(c));
    }
    u.rawGedcom = options.preserve ? raw : [];
    project.unions[u.id] = u;
    report.families++;
    for (const c of children(rec, 'CHIL')) {
      if (isVoid(c.value)) continue;
      const p = persons.get(c.value.trim());
      if (!p) {
        report.danglingReferences++;
        continue;
      }
      const rel = pedi.get(`${rec.xref ?? ''}|${c.value.trim()}`) ?? 'biological';
      const link = createChildLink(u.id, p.id, rel);
      project.childLinks[link.id] = link;
      report.childLinks++;
    }
  }

  // Unreferenced top-level records, preserved verbatim.
  for (const rec of file.records) {
    if (['HEAD', 'TRLR', 'INDI', 'FAM'].includes(rec.tag)) continue;
    if ((rec.tag === 'NOTE' || rec.tag === 'SNOTE') && rec.xref && referencedNotes.has(rec.xref)) continue;
    if (rec.tag === 'SUBM' || rec.tag === 'SUBN') {
      ignore(rec.tag); // regenerated on export
      continue;
    }
    const lines = nodeToLines(rec);
    report.preservedRecords++;
    report.preservedLines += lines.length;
    if (options.preserve) project.rawRecords.push(lines.join('\n'));
    else ignore(rec.tag);
  }
  for (const p of Object.values(project.persons)) report.preservedLines += p.rawGedcom.length;
  for (const u of Object.values(project.unions)) report.preservedLines += u.rawGedcom.length;

  report.warnings = validateProject(project);
  return { ok: true, project, report };
}

/** Bytes -> project, with encoding detection. */
export function importGedcomBytes(bytes: Uint8Array, preserve = true): ImportResult {
  if (bytes.length === 0) return { ok: false, reason: 'empty' };
  const dec = decodeGedcom(bytes);
  if (!/\b(HEAD|INDI|FAM)\b/.test(dec.text.slice(0, 20000))) return { ok: false, reason: 'unreadable' };
  return importGedcomText(dec.text, { preserve, declared: dec.declared, detected: dec.detected, mismatch: dec.mismatch });
}
