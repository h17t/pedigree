import { describe, expect, it } from 'vitest';
import { migrateProject, migrations, normalizeProject } from '@/model/schema';
import { SCHEMA_VERSION, createProject, createPerson } from '@/model/types';

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
