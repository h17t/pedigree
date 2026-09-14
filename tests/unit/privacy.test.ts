import { describe, expect, it } from 'vitest';
import { privateIds, withoutPrivate } from '@/model/privacy';
import { exportGedcom } from '@/gedcom/fromModel';
import { build, born } from './fixtures';

describe('withoutPrivate', () => {
  it('returns the same project when nobody is private', () => {
    const b = build();
    b.person('A');
    expect(withoutPrivate(b.project)).toBe(b.project);
    expect(privateIds(b.project).size).toBe(0);
  });

  it('drops private people, keeps their partner as a single parent and their children with the other parent', () => {
    const b = build();
    const dad = b.person('Dad', { isPrivate: true }), mum = b.person('Mum');
    const kid = b.person('Kid', born('1950')), secret = b.person('Secret', { isPrivate: true });
    const fam = b.family([dad, mum], [kid, secret]);
    const out = withoutPrivate(b.project);
    expect(Object.keys(out.persons).sort()).toEqual([kid.id, mum.id].sort());
    expect(out.unions[fam.id]!.partnerIds).toEqual([mum.id]);
    expect(Object.values(out.childLinks).map((l) => l.childId)).toEqual([kid.id]);
    // The original is untouched.
    expect(Object.keys(b.project.persons)).toHaveLength(4);
    expect(b.project.unions[fam.id]!.partnerIds).toHaveLength(2);
  });

  it('removes a childless partnership with a private partner instead of leaving a single-person union', () => {
    const b = build();
    const a = b.person('A', { isPrivate: true }), c = b.person('C');
    const u = b.union([a, c]);
    const out = withoutPrivate(b.project);
    expect(out.unions[u.id]).toBeUndefined();
    expect(Object.keys(out.persons)).toEqual([c.id]);
  });

  it('is what the GEDCOM export writes: no INDI for private people', () => {
    const b = build();
    b.person('Shown', { surname: 'Visible' });
    b.person('Hidden', { surname: 'Secret', isPrivate: true });
    const { text } = exportGedcom(withoutPrivate(b.project), { preserve: false, sourceName: 'T', sourceVersion: '1' });
    expect(text).toContain('/Visible/');
    expect(text).not.toContain('Secret');
  });
});
