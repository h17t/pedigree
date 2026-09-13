import { describe, expect, it } from 'vitest';
import { build, born, died } from './fixtures';
import { validateProject } from '@/model/validation';
import { effectiveLifeStatus } from '@/model/types';

const codes = (w: { code: string }[]) => w.map((x) => x.code).sort();

describe('validateProject', () => {
  it('is quiet on a plausible family', () => {
    const b = build();
    const m = b.person('Mother', { ...born('1920-01-01'), ...died('1990-01-01') });
    const f = b.person('Father', { sex: 'male', ...born('1918'), ...died('1980') });
    const k = b.person('Kid', born('1950-05-05'));
    b.family([m, f], [k]);
    expect(validateProject(b.project, '2026-09-13')).toEqual([]);
  });

  it('warns when a child is older than a parent', () => {
    const b = build();
    const p = b.person('Parent', born('1950'));
    const k = b.person('Kid', born('1940'));
    b.family([p], [k]);
    const w = validateProject(b.project);
    expect(codes(w)).toEqual(['childOlderThanParent']);
    expect(w[0]!.params).toEqual({ child: 'Kid Test', parent: 'Parent Test' });
  });

  it('does not apply the parent-age rule to step and foster links', () => {
    const b = build();
    const p = b.person('Step', born('1950'));
    const k = b.person('Kid', born('1940'));
    const u = b.union([p]);
    b.child(u, k, 'step');
    expect(validateProject(b.project)).toEqual([]);
  });

  it('warns on death before birth', () => {
    const b = build();
    b.person('X', { ...born('1950-06-01'), ...died('1950-05-01') });
    expect(codes(validateProject(b.project))).toEqual(['deathBeforeBirth']);
  });

  it('warns on a birth more than nine months after the father died', () => {
    const b = build();
    const f = b.person('Father', { sex: 'male', ...born('1900'), ...died('1940-01-01') });
    const k = b.person('Kid', born('1941-06-01'));
    b.family([f], [k]);
    expect(codes(validateProject(b.project))).toEqual(['birthAfterFatherDeath']);
    // but not for a mother, and not within nine months
    const b2 = build();
    const m = b2.person('Mother', { sex: 'female', ...born('1900'), ...died('1940-01-01') });
    const k2 = b2.person('Kid', born('1941-06-01'));
    b2.family([m], [k2]);
    expect(validateProject(b2.project)).toEqual([]);
  });

  it('warns on a cycle once per affected person and never throws', () => {
    const b = build();
    const a = b.person('A'), c = b.person('C');
    b.family([a], [c]);
    b.family([c], [a]);
    expect(codes(validateProject(b.project))).toEqual(['cycle', 'cycle']);
  });

  it('warns on implausible age and on living people born over 120 years ago', () => {
    const b = build();
    b.person('Old', { ...born('1800'), ...died('1930') });
    b.person('Alive', { ...born('1900'), lifeStatus: 'living' });
    expect(codes(validateProject(b.project, '2026-09-13'))).toEqual(['implausibleAge', 'livingTooOld']);
  });

  it('a death date forces deceased regardless of the field', () => {
    const b = build();
    const p = b.person('X', { ...died('1990'), lifeStatus: 'living' });
    expect(effectiveLifeStatus(p)).toBe('deceased');
    // and living status is read from the field, never inferred from a missing date
    const q = b.person('Y', { lifeStatus: 'unknown' });
    expect(effectiveLifeStatus(q)).toBe('unknown');
  });

  it('warns on marriage under 14', () => {
    const b = build();
    const p = b.person('Young', born('1900'));
    b.union([p], { marriageDate: '1912' });
    expect(codes(validateProject(b.project))).toEqual(['partnerAge']);
  });
});
