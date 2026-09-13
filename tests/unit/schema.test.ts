import { describe, expect, it } from 'vitest';
import { migrateProject, migrations, normalizeProject } from '@/model/schema';
import { SCHEMA_VERSION, createProject } from '@/model/types';

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
        expect(r.changes).toEqual(['Added migratedField']);
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
