import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { importGedcomBytes, importGedcomText, exportGedcom, decodeGedcom, parseGedcomDate, formatGedcomDate } from '@/gedcom';
import { lex } from '@/gedcom/lexer';
import { lineFor } from '@/gedcom/parse';
import { decodeAnsel } from '@/gedcom/ansel';
import { migrateProject } from '@/model/schema';
import sample from '@/fixtures/sample-family.json';
import type { Person, Project, Union } from '@/model/types';
import { personName } from '@/model/types';

const read = (f: string) => new Uint8Array(readFileSync(`tests/gedcom/${f}`));
const opts = { preserve: true, sourceName: 'Pedigree', sourceVersion: 'test', now: new Date(Date.UTC(2026, 8, 13)) };

describe('lexer', () => {
  it('joins CONC/CONT and tolerates CR, LF and leading spaces', () => {
    const r = lex('0 HEAD\r\n1 NOTE first\r\n2 CONC  part\n2 CONT second\r  0 TRLR');
    expect(r.lines.map((l) => [l.level, l.tag, l.value])).toEqual([[0, 'HEAD', ''], [1, 'NOTE', 'first part\nsecond'], [0, 'TRLR', '']]);
    expect(r.problems).toEqual([]);
  });
});

describe('dates', () => {
  it.each([
    ['14 MAR 1923', '1923-03-14', 'exact', undefined],
    ['MAR 1923', '1923-03', 'exact', undefined],
    ['1923', '1923', 'exact', undefined],
    ['ABT 1923', '1923', 'about', undefined],
    ['EST 1923', '1923', 'estimated', undefined],
    ['CAL 1923', '1923', 'about', 'CAL 1923'],
    ['BEF 1923', '1923', 'before', undefined],
    ['AFT 14 MAR 1923', '1923-03-14', 'after', undefined],
    ['BET 1920 AND 1925', '1920', 'between', undefined],
    ['FROM 1905 TO 1962', '1905', 'from', undefined],
    ['FROM 1905', '1905', 'from', undefined],
    ['TO 1962', '1962', 'before', 'TO 1962'],
    ['BET ABT 1920 AND 1925', null, 'between', 'BET ABT 1920 AND 1925'],
    ['JULIAN 14 FEB 1720', '1720-02-14', 'exact', 'JULIAN 14 FEB 1720'],
    ['GREGORIAN 14 FEB 1720', '1720-02-14', 'exact', undefined],
    ['100 BCE', null, 'exact', '100 BCE'],
    ['@#DJULIAN@ 14 FEB 1720/21', '1720-02-14', 'exact', '@#DJULIAN@ 14 FEB 1720/21'],
    ['1750/51', '1750', 'exact', '1750/51'],
    ['(unknown)', null, 'exact', '(unknown)'],
    ['14.03.1923', '1923-03-14', 'exact', '14.03.1923'],
  ])('%s', (input, date, qualifier, verbatim) => {
    const r = parseGedcomDate(input);
    expect(r.date).toBe(date);
    expect(r.qualifier).toBe(qualifier);
    expect(r.gedcomDate).toBe(verbatim);
  });
  it('formats back and prefers the verbatim original', () => {
    expect(formatGedcomDate('1923-03-14', 'exact')).toBe('14 MAR 1923');
    expect(formatGedcomDate('1923-03', 'about')).toBe('ABT MAR 1923');
    expect(formatGedcomDate('1923', 'before')).toBe('BEF 1923');
    expect(formatGedcomDate('1920', 'about', 'BET 1920 AND 1925')).toBe('BET 1920 AND 1925');
    expect(formatGedcomDate('1920', 'between', undefined, '1925-03-01')).toBe('BET 1920 AND 1 MAR 1925');
    expect(formatGedcomDate('1905', 'from', undefined, '1962')).toBe('FROM 1905 TO 1962');
    expect(formatGedcomDate('1905', 'from', undefined, null)).toBe('FROM 1905');
    expect(parseGedcomDate('BET 1920 AND 1925').dateEnd).toBe('1925');
  });
});

describe('encodings', () => {
  it('detects UTF-8, Windows-1252 declared as ANSI, UTF-16 with BOM and ANSEL', () => {
    expect(decodeGedcom(read('gramps-utf8.ged')).detected).toBe('utf-8');
    const w = decodeGedcom(read('ahnenblatt-win1252.ged'));
    expect(w.detected).toBe('windows-1252');
    expect(w.declared).toBe('ANSI');
    expect(w.text).toContain('Jürgen /Müller/');
    expect(w.text).toContain('Preis 5 €');
    const u = decodeGedcom(read('utf16.ged'));
    expect(u.detected).toBe('utf-16le');
    expect(u.text).toContain('Søren /Ærø/');
    const a = decodeGedcom(read('ansel.ged'));
    expect(a.detected).toBe('ansel');
    expect(a.text).toContain('Hans /Müller/');
    expect(a.text).toContain('PLAC Lübeck');
  });
  it('falls back to Windows-1252 when a file declared UTF-8 is not valid UTF-8', () => {
    const bytes = new Uint8Array([...new TextEncoder().encode('0 HEAD\n1 CHAR UTF-8\n0 @I1@ INDI\n1 NAME J'), 0xfc, ...new TextEncoder().encode('rgen /X/\n0 TRLR')]);
    const d = decodeGedcom(bytes);
    expect(d.detected).toBe('windows-1252');
    expect(d.mismatch).toBe(true);
    expect(d.text).toContain('Jürgen');
  });
  it('decodes ANSEL combining marks and spacing characters', () => {
    expect(decodeAnsel(new Uint8Array([0xe8, 0x75, 0xa5, 0xc7]))).toBe('üÆß');
  });
});

describe('import', () => {
  const r = importGedcomBytes(read('gramps-utf8.ged'));
  if (!r.ok) throw new Error('import failed');
  const { project, report } = r;
  const byName = (n: string) => Object.values(project.persons).find((p) => personName(p) === n)!;

  it('maps names, sex, events, notes, custom fields, PEDI and preserves the rest', () => {
    expect(report.individuals).toBe(7);
    expect(report.families).toBe(2);
    expect(report.childLinks).toBe(4);
    const karl = byName('Karl Weber');
    expect(karl.nickname).toBe('Kalle');
    expect(karl.birth).toMatchObject({ date: '1878-02-11', qualifier: 'exact', place: 'Landau in der Pfalz' });
    expect(karl.death.cause).toBe('Herzschwäche');
    expect(karl.events).toHaveLength(1);
    expect(karl.events[0]).toMatchObject({ type: 'baptism', date: '1878-02-24', place: 'Stiftskirche Landau' });
    expect(karl.occupation).toBe('Winzer');
    expect(karl.notes).toBe('Ein Winzer aus der Pfalz. Zweite Zeile mit Umlauten: äöü ß.\nDritte Zeile nach CONT.');
    expect(karl.customFields).toEqual([{ label: 'Weingut', value: 'Weber & Söhne' }]);
    expect(karl.gedcomXref).toBe('@I1@');
    const raw = karl.rawGedcom.join('\n');
    expect(raw).toContain('1 SOUR @S1@');
    expect(raw).toContain('2 PAGE Familienbuch S. 12');
    expect(raw).toContain('1 _UID 1234567890ABCDEF');
    expect(raw).toContain('2 SOUR @S1@'); // the citation inside BIRT, kept under a BIRT line
    const anna = byName('Anna Weber');
    expect(anna.birthName).toBe('Schmidt');
    expect(anna.birth).toMatchObject({ date: '1884', qualifier: 'about' });
    expect(anna.death).toMatchObject({ date: '1960', qualifier: 'between', dateEnd: '1962' });
    expect(anna.death.gedcomDate).toBeUndefined();
    expect(anna.events[0]).toMatchObject({ type: 'residence', date: '1905', qualifier: 'from', dateEnd: '1962', place: 'Landau' });
    const dieter = byName('Dieter Braun');
    expect(dieter.notes).toBe('Adoptiert 1951.');
    expect(dieter.birth.qualifier).toBe('estimated');
    const link = Object.values(project.childLinks).find((l) => l.childId === dieter.id)!;
    expect(link.relationType).toBe('adopted');
    expect(byName('Alex Weber').sex).toBe('diverse');
    const friedrich = byName('Friedrich Weber');
    expect(friedrich.lifeStatus).toBe('deceased');
    expect(friedrich.death.date).toBeNull();
    const robert = byName('Robert Lindner');
    expect(robert.birth).toMatchObject({ date: '1720-02-14', gedcomDate: '@#DJULIAN@ 14 FEB 1720/21' });
    expect(robert.events[0]).toMatchObject({ type: 'emigration', date: '1884', place: 'Bremerhaven' });
  });

  it('maps families, marriage, divorce and keeps custom family lines', () => {
    const f1 = Object.values(project.unions).find((u) => u.gedcomXref === '@F1@')!;
    expect(f1.partnerIds).toHaveLength(2);
    expect(f1).toMatchObject({ type: 'marriage', status: 'married', marriageDate: '1905-09-16', marriagePlace: 'Edenkoben' });
    expect(f1.rawGedcom).toEqual(['1 _CUSTOMFAM something']);
    const f2 = Object.values(project.unions).find((u) => u.gedcomXref === '@F2@')!;
    expect(f2.partnerIds).toHaveLength(1);
    expect(f2.status).toBe('divorced');
    expect(f2.divorceDate).toBe('1890');
  });

  it('preserves unreferenced top-level records verbatim and reports encoding, ignored tags and uncertain dates', () => {
    expect(project.rawRecords.some((x) => x.startsWith('0 @S1@ SOUR'))).toBe(true);
    expect(project.rawRecords.some((x) => x.startsWith('0 @R1@ REPO'))).toBe(true);
    expect(project.rawRecords.some((x) => x.startsWith('0 @O1@ OBJE'))).toBe(true);
    expect(project.rawRecords.some((x) => x.startsWith('0 @N1@ NOTE'))).toBe(false);
    expect(report.encodingDetected).toBe('utf-8');
    expect(report.encodingDeclared).toBe('UTF-8');
    expect(report.sourceProgram).toBe('Gramps');
    expect(report.gedcomVersion).toBe('5.5.1');
    expect(report.ignoredTags._UID).toBe(1);
    expect(report.ignoredTags._CUSTOMFAM).toBe(1);
    expect(report.uncertainDates.map((u) => u.value)).toEqual(expect.arrayContaining(['ABT 1884', 'EST 1945', '@#DJULIAN@ 14 FEB 1720/21']));
    expect(report.uncertainDates.map((u) => u.value)).not.toContain('BET 1960 AND 1962');
    expect(report.notes).toEqual(expect.arrayContaining(['sexXAsDiverse', 'marnmAsSurname', 'noteRecordsInlined']));
    expect(report.danglingReferences).toBe(0);
    expect(report.problems).toEqual([]);
  });

  it('reads Windows-1252 (Ahnenblatt) and numeric dates', () => {
    const w = importGedcomBytes(read('ahnenblatt-win1252.ged'));
    expect(w.ok).toBe(true);
    if (!w.ok) return;
    const b = Object.values(w.project.persons).find((p) => p.givenNames === 'Bärbel')!;
    expect(b.surname).toBe('Schäfer');
    expect(b.birthName).toBe('Müller');
    expect(b.birth).toMatchObject({ date: '1952-03-14', gedcomDate: '14.03.1952' });
    expect(w.report.encodingDetected).toBe('windows-1252');
    const j = Object.values(w.project.persons).find((p) => p.givenNames === 'Jürgen')!;
    expect(j.notes).toBe('Größe: 1,80 m – Preis 5 €');
  });

  it('survives a malformed file and reports the problems and dangling references', () => {
    const m = importGedcomBytes(read('malformed.ged'));
    expect(m.ok).toBe(true);
    if (!m.ok) return;
    expect(m.report.individuals).toBe(2);
    expect(m.report.problems.length).toBeGreaterThanOrEqual(2);
    expect(m.report.danglingReferences).toBe(2);
    expect(m.report.uncertainDates.some((u) => u.value === '31 FEB 1900')).toBe(true);
  });

  it('reads a GEDCOM 7 file: header, names, sex, events, ranges, calendars, shared notes, VOID pointers', () => {
    const r = importGedcomBytes(read('gedcom7.ged'));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const { project, report } = r;
    expect(report.gedcomVersion).toBe('7.0');
    expect(report.notes).toContain('gedcom7');
    expect(report.individuals).toBe(3);
    expect(report.families).toBe(1);
    expect(report.danglingReferences).toBe(0);
    const byName = (n: string) => Object.values(project.persons).find((p) => `${p.givenNames} ${p.surname}` === n)!;
    const eva = byName('Eva Klein');
    expect(eva.sex).toBe('female');
    expect(eva.birth).toMatchObject({ date: '1920', qualifier: 'between', dateEnd: '1925', place: 'Mainz' });
    expect(eva.notes).toBe('Shared note about Eva.');
    expect(eva.death).toMatchObject({ date: '1988-02-14', qualifier: 'exact' });
    expect(eva.events.map((e) => e.type)).toEqual(['baptism', 'burial']);
    expect(eva.events[1]).toMatchObject({ date: '1988-02-18', place: 'Mainz' });
    const kai = byName('Kai Klein');
    expect(kai.sex).toBe('diverse');
    expect(kai.birth).toMatchObject({ date: '1950-05-01', qualifier: 'exact' });
    const ulf = byName('Ulf Klein');
    expect(ulf.birth.qualifier).toBe('exact');
    expect(ulf.birth.gedcomDate).toBe('JULIAN 1 JAN 1700');
    const fam = Object.values(project.unions)[0]!;
    expect(fam.partnerIds).toEqual([eva.id]);
    expect(fam.marriageDate).toBe('1948');
    expect(Object.values(project.childLinks).map((l) => l.childId)).toEqual([kai.id]);
    expect(Object.values(project.childLinks)[0]!.relationType).toBe('adopted');
    expect(fam.notes).toBe('Family note.');
    expect(project.rawRecords.length).toBe(0);
  });

  it('refuses empty or non-GEDCOM input', () => {
    expect(importGedcomBytes(new Uint8Array())).toEqual({ ok: false, reason: 'empty' });
    expect(importGedcomBytes(new TextEncoder().encode('hello world'))).toEqual({ ok: false, reason: 'unreadable' });
  });

  it('without preservation, raw data is dropped and reported as ignored', () => {
    const r2 = importGedcomBytes(read('gramps-utf8.ged'), false);
    if (!r2.ok) throw new Error('x');
    expect(r2.project.rawRecords).toEqual([]);
    expect(Object.values(r2.project.persons).every((p) => p.rawGedcom.length === 0)).toBe(true);
    expect(r2.report.ignoredTags.SOUR).toBeGreaterThan(0);
  });
});

/** Compare two projects ignoring ids and positions (model equality). */
function canonical(project: Project) {
  const persons = Object.values(project.persons);
  const keyOf = (p: Person) => `${p.givenNames}|${p.surname}|${p.birth.date ?? ''}`;
  const byId = new Map(persons.map((p) => [p.id, keyOf(p)]));
  const strip = (p: Person) => {
    const { id: _id, position: _pos, gedcomXref: _x, events, ...rest } = p;
    return { ...rest, events: events.map(({ id: _e, ...e }) => e) };
  };
  const unions = Object.values(project.unions)
    .map((u: Union) => {
      const { id: _id, position: _pos, gedcomXref: _x, ...rest } = u;
      const kids = Object.values(project.childLinks)
        .filter((l) => l.unionId === u.id)
        .map((l) => `${byId.get(l.childId)}:${l.relationType}`)
        .sort();
      return { ...rest, partnerIds: u.partnerIds.map((p) => byId.get(p)).sort(), children: kids };
    })
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return { persons: persons.map(strip).sort((a, b) => keyOf(a as Person).localeCompare(keyOf(b as Person))), unions, rawRecords: [...project.rawRecords].sort() };
}

describe('round trip', () => {
  it('import -> export -> import yields an identical model (ignoring ids)', () => {
    const a = importGedcomBytes(read('gramps-utf8.ged'));
    if (!a.ok) throw new Error('a');
    const { text } = exportGedcom(a.project, opts);
    const b = importGedcomText(text);
    if (!b.ok) throw new Error('b');
    expect(canonical(b.project)).toEqual(canonical(a.project));
    expect(b.report.problems).toEqual([]);
    expect(b.report.danglingReferences).toBe(0);
    expect(text).toContain('1 SOUR @S1@');
    expect(text).toContain('0 @S1@ SOUR');
    expect(text).toContain('@I1@ INDI');
    expect(text).toContain('2 _MARNM Weber');
    expect(text).toContain('1 SEX X');
    expect(text).toContain('1 _GENDER diverse');
    expect(text).toContain('2 PEDI adopted');
    expect(text).toContain('2 DATE BET 1960 AND 1962');
    expect(text).toContain('2 DATE @#DJULIAN@ 14 FEB 1720/21');
    expect(text.split('\r\n')[0]).toBe('0 HEAD');
    expect(text.trim().endsWith('0 TRLR')).toBe(true);
  });

  it('the sample family exports and re-imports cleanly in a strict parse', () => {
    const m = migrateProject(sample);
    if (!m.ok) throw new Error('sample');
    const { text, report } = exportGedcom(m.project, opts);
    expect(report.individuals).toBe(48);
    expect(report.notes).toContain('sameSexAsHusbWife');
    expect(report.notes).toContain('customFieldsAsUdf');
    const back = importGedcomText(text);
    if (!back.ok) throw new Error('back');
    expect(back.report.problems).toEqual([]);
    expect(back.report.individuals).toBe(48);
    expect(back.report.families).toBe(17);
    expect(back.report.childLinks).toBe(32);
    const c1 = canonical(m.project), c2 = canonical(back.project);
    expect(c2.unions.length).toBe(c1.unions.length);
    for (let i = 0; i < c1.persons.length; i++) {
      const p1 = c1.persons[i]!, p2 = c2.persons[i]!;
      expect([p2.givenNames, p2.surname, p2.birthName, p2.birth, p2.death, p2.occupation, p2.notes, p2.customFields, p2.events]).toEqual([p1.givenNames, p1.surname, p1.birthName, p1.birth, p1.death, p1.occupation, p1.notes, p1.customFields, p1.events]);
    }
    expect(c2.unions.map((u) => [u.partnerIds, u.children, u.marriageDate, u.status])).toEqual(c1.unions.map((u) => [u.partnerIds, u.children, u.marriageDate, u.status]));
  });

  it('export without preservation drops raw data and says so', () => {
    const a = importGedcomBytes(read('gramps-utf8.ged'));
    if (!a.ok) throw new Error('a');
    const { text, report } = exportGedcom(a.project, { ...opts, preserve: false });
    expect(report.notes).toContain('preservationOff');
    expect(text).not.toContain('0 @S1@ SOUR');
    expect(text).not.toContain('1 SOUR @S1@');
  });
});

describe('values that look like GEDCOM syntax survive a round trip', () => {
  it('escapes a leading @ and reads it back, and never lets a value split the line', () => {
    const written = lineFor(1, null, 'NOTE', '@work — kept\r\nsecond line');
    expect(written[0]).toBe('1 NOTE @@work — kept');
    expect(written[1]).toBe('2 CONT second line');
    expect(written.every((l) => !/[\r]/.test(l))).toBe(true);
    const read = lex(written.join('\r\n'));
    expect(read.problems).toEqual([]);
    expect(read.lines[0]!.value).toBe('@work — kept\nsecond line');
  });

  it('writes and reads every shape of value that starts with @ without drift', () => {
    const trip = (v: string) => lex(lineFor(1, null, 'NOTE', v).join('\r\n')).lines[0]!.value;
    const values = ['@work', '@@already', 'plain', '@I1@', '@#DJULIAN@ 14 FEB 1720', 'a@b', '@', '@@', '@x@ trailing', 'line1\nline2', '@a\n@b'];
    // A continuation line is text as well, so it is escaped like the first one.
    values.push('@a\n@@b', 'x\n@@y', 'x\n@y', '@@a\n@@b');
    for (const v of values) {
      expect(trip(v), v).toBe(v);
      expect(trip(trip(v)), v).toBe(v); // and again, so repeated exports cannot drift
    }
  });
});
