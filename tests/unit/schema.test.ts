import { describe, expect, it } from 'vitest';
import { migrateProject, migrations, normalizeProject } from '@/model/schema';
import { validateProject } from '@/model/validation';
import { SCHEMA_VERSION, createProject, createPerson, defaultCardAppearance } from '@/model/types';
import { DEFAULT_TINTS } from '@/design/tint';

describe('migrateProject', () => {
  it('accepts the current version unchanged', () => {
    const p = createProject('x');
    const r = migrateProject(JSON.parse(JSON.stringify(p)));
    expect(r.ok && r.fromVersion).toBe(SCHEMA_VERSION);
    expect(r.ok && r.changes).toEqual([]);
  });

  it('refuses a newer version politely and leaves it untouched', () => {
    const p = { ...createProject('x'), schemaVersion: SCHEMA_VERSION + 5 };
    const r = migrateProject(p);
    expect(r).toEqual({ ok: false, reason: 'newer', fileVersion: SCHEMA_VERSION + 5 });
  });

  it('rejects things that are not projects', () => {
    expect(migrateProject(null).ok).toBe(false);
    expect(migrateProject('nope').ok).toBe(false);
    expect(migrateProject({ schemaVersion: 1 }).ok).toBe(false);
  });

  it('runs registered steps in order and reports each', () => {
    // Simulate a future migration chain without touching the real registry permanently.
    const original = { ...migrations };
    try {
      migrations[0] = (d) => ({ data: { ...d, migratedField: true }, note: 'Added migratedField' });
      const p = { ...createProject('x'), schemaVersion: 0 };
      const r = migrateProject(p);
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.fromVersion).toBe(0);
        expect(r.changes[0]).toBe('Added migratedField');
        expect(r.changes).toHaveLength(SCHEMA_VERSION);
        expect(r.project.schemaVersion).toBe(SCHEMA_VERSION);
        expect((r.project as unknown as { migratedField: boolean }).migratedField).toBe(true);
      }
    } finally {
      for (const k of Object.keys(migrations)) delete migrations[Number(k)];
      Object.assign(migrations, original);
    }
  });

  it('normalizes missing collections', () => {
    const p = normalizeProject({ schemaVersion: 1, id: 'a', name: 'n', persons: {}, unions: {} });
    expect(p.childLinks).toEqual({});
    expect(p.rawRecords).toEqual([]);
    expect(p.settings.preserveRawGedcom).toBe(true);
  });

  it('a tree saved before the settings existed keeps its look: one spacing for both axes, cards at their defaults', () => {
    const p = normalizeProject({ schemaVersion: 2, id: 'a', name: 'n', persons: {}, unions: {}, settings: { spacing: 'wide' } });
    expect(p.settings.spacing).toBe('wide');
    expect(p.settings.rowSpacing).toBe('wide');
    expect(p.settings.cards).toEqual(defaultCardAppearance());
  });

  it('keeps the card settings a file does state and replaces the ones it does not', () => {
    const p = normalizeProject({ schemaVersion: 2, id: 'a', name: 'n', persons: {}, unions: {}, settings: { cards: { sexTint: false, places: 'yes', tints: { male: '#123456', female: 'not a colour' } } } });
    expect(p.settings.cards).toEqual({ ...defaultCardAppearance(), sexTint: false, tints: { ...DEFAULT_TINTS, male: '#123456' } });
  });
});

describe('schema 1 → 2: branch tags become colour groups', () => {
  it('creates one group per distinct tag, points people at it and drops the tag field', () => {
    const v1 = {
      ...createProject('old'),
      schemaVersion: 1,
      persons: {
        a: { ...createPerson({ id: 'a', givenNames: 'A' }), tag: { color: 'green', label: 'Weber' } },
        b: { ...createPerson({ id: 'b', givenNames: 'B' }), tag: { color: 'green', label: 'Weber' } },
        c: { ...createPerson({ id: 'c', givenNames: 'C' }), tag: { color: 'plum', label: 'Koch' } },
        d: { ...createPerson({ id: 'd', givenNames: 'D' }), tag: null },
      },
    } as unknown as Record<string, unknown>;
    const r = migrateProject(v1);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.project.groups.map((g) => `${g.name}/${g.color}`)).toEqual(['Weber/green', 'Koch/plum']);
    const weber = r.project.groups[0]!.id;
    expect(r.project.persons.a!.groupId).toBe(weber);
    expect(r.project.persons.b!.groupId).toBe(weber);
    expect(r.project.persons.c!.groupId).toBe(r.project.groups[1]!.id);
    expect(r.project.persons.d!.groupId).toBeNull();
    expect('tag' in r.project.persons.a!).toBe(false);
    expect(r.changes).toContain('Family branch tags became colour groups');
  });
});

describe('normalizeProject repairs hand-edited or third-party files', () => {
  const base = { schemaVersion: SCHEMA_VERSION, id: 'x', name: 'n', createdAt: 1, modifiedAt: 1 };
  const load = (extra: Record<string, unknown>) => {
    const m = migrateProject({ ...base, persons: {}, unions: {}, childLinks: {}, ...extra });
    if (!m.ok) throw new Error('refused');
    return m.project;
  };

  it('drops records that are not objects instead of crashing later', () => {
    const p = load({ unions: { u1: null }, childLinks: { l1: null }, persons: { p1: 'nope' } });
    expect(Object.keys(p.persons)).toHaveLength(0);
    expect(Object.keys(p.unions)).toHaveLength(0);
    expect(Object.keys(p.childLinks)).toHaveLength(0);
    expect(() => validateProject(p)).not.toThrow();
  });

  it('fills in missing sub-objects and wrong types with the defaults', () => {
    const p = load({ persons: { p1: { id: 'p1', givenNames: 'A', surname: 'B', events: 'no', position: { x: 'a', y: 2 }, groupId: 7, birth: null } } });
    const person = p.persons.p1!;
    expect(person.birth).toEqual({ date: null, qualifier: 'exact', place: '', note: '' });
    expect(person.death.cause).toBe('');
    expect(person.events).toEqual([]);
    expect(person.position).toBeNull();
    expect(person.groupId).toBeNull();
    expect(person.givenNames).toBe('A');
    expect(() => validateProject(p)).not.toThrow();
  });

  it('keeps optional range fields and drops dangling references', () => {
    const p = load({
      persons: { p1: { id: 'p1', givenNames: 'A', surname: 'B', birth: { date: '1920', qualifier: 'between', dateEnd: '1925', place: '', note: '' } } },
      unions: { u1: { id: 'u1', partnerIds: ['p1', 'ghost', 'p1'] }, u2: { id: 'u2', partnerIds: ['ghost'] } },
      childLinks: { l1: { id: 'l1', unionId: 'u1', childId: 'ghost', relationType: 'biological' }, l2: { id: 'l2', unionId: 'gone', childId: 'p1', relationType: 'biological' } },
    });
    expect(p.persons.p1!.birth.dateEnd).toBe('1925');
    expect(p.unions.u1!.partnerIds).toEqual(['p1']);
    expect(p.unions.u2).toBeUndefined(); // no partner left and no children
    expect(Object.keys(p.childLinks)).toHaveLength(0);
  });

  it('never lets a key from the file change an object prototype', () => {
    const person = JSON.parse('{"id":"p1","givenNames":"A","surname":"B","__proto__":{"polluted":1}}') as Record<string, unknown>;
    const p = load({ persons: { p1: person } });
    expect(Object.getPrototypeOf(p.persons.p1!)).toBe(Object.prototype);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});

describe('normalizeProject refuses ids and versions that are not data', () => {
  it('drops a record keyed like a prototype instead of changing the object', () => {
    const raw = JSON.parse(
      `{"schemaVersion":${SCHEMA_VERSION},"id":"x","name":"n","persons":{"__proto__":{"id":"__proto__","givenNames":"Ghost","surname":"G"},"p1":{"id":"p1","givenNames":"A","surname":"B"}},"unions":{},"childLinks":{}}`,
    ) as unknown;
    const m = migrateProject(raw);
    expect(m.ok).toBe(true);
    if (!m.ok) return;
    expect(Object.keys(m.project.persons)).toEqual(['p1']);
    expect(Object.getPrototypeOf(m.project.persons)).toBe(Object.prototype);
    // Without the guard this lookup would inherit "Ghost" from the poisoned prototype.
    expect((m.project.persons as Record<string, unknown>).givenNames).toBeUndefined();
  });

  it('refuses a schema version that is not a whole number', () => {
    for (const v of [NaN, 1.5, -1, Infinity]) {
      const r = migrateProject({ schemaVersion: v, id: 'x', name: 'n', persons: {}, unions: {}, childLinks: {} });
      expect(r.ok, String(v)).toBe(false);
    }
  });
});
