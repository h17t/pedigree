import { describe, expect, it } from 'vitest';
import sample from '@/fixtures/sample-family.json';
import { migrateProject } from '@/model/schema';
import { validateProject } from '@/model/validation';
import { connectedComponents, generations, breakCycles } from '@/model/graph';
import { effectiveLifeStatus } from '@/model/types';

const m = migrateProject(sample);
if (!m.ok) throw new Error('sample does not load');
const project = m.project;

describe('sample family fixture', () => {
  it('is a well-formed project of about 40 people', () => {
    const n = Object.keys(project.persons).length;
    expect(n).toBeGreaterThanOrEqual(40);
    expect(n).toBeLessThanOrEqual(50);
    for (const l of Object.values(project.childLinks)) {
      expect(project.unions[l.unionId], l.id).toBeDefined();
      expect(project.persons[l.childId], l.id).toBeDefined();
    }
    for (const u of Object.values(project.unions)) for (const pid of u.partnerIds) expect(project.persons[pid]).toBeDefined();
  });

  it('contains the awkward cases the brief asks for', () => {
    const unions = Object.values(project.unions);
    const links = Object.values(project.childLinks);
    expect(unions.some((u) => u.partnerIds.length === 0)).toBe(true); // parents unknown
    expect(unions.some((u) => u.status === 'divorced')).toBe(true);
    expect(unions.some((u) => u.type === 'unmarried')).toBe(true);
    expect(links.some((l) => l.relationType === 'adopted')).toBe(true);
    expect(links.some((l) => l.relationType === 'foster')).toBe(true);
    // multiple marriages: a person in two unions with 2 partners
    const counts = new Map<string, number>();
    for (const u of unions) if (u.partnerIds.length === 2) for (const p of u.partnerIds) counts.set(p, (counts.get(p) ?? 0) + 1);
    expect([...counts.values()].some((c) => c >= 2)).toBe(true);
    // a child linked to two unions (biological + adoptive)
    const byChild = new Map<string, number>();
    for (const l of links) byChild.set(l.childId, (byChild.get(l.childId) ?? 0) + 1);
    expect([...byChild.values()].some((c) => c >= 2)).toBe(true);
    // uncertain dates and incomplete records
    const people = Object.values(project.persons);
    expect(people.some((p) => p.birth.qualifier === 'about')).toBe(true);
    expect(people.some((p) => p.birth.qualifier === 'estimated')).toBe(true);
    expect(people.some((p) => p.death.qualifier === 'after')).toBe(true);
    expect(people.some((p) => p.birth.date === null)).toBe(true);
    expect(people.some((p) => effectiveLifeStatus(p) === 'unknown')).toBe(true);
    expect(people.some((p) => effectiveLifeStatus(p) === 'living')).toBe(true);
    expect(people.every((p) => p.position === null)).toBe(true);
  });

  it('has a disconnected second family and one isolated person', () => {
    const comps = connectedComponents(project);
    expect(comps.length).toBe(3);
    expect(comps[2]).toHaveLength(1);
    expect(comps[1]!.length).toBeGreaterThanOrEqual(6);
  });

  it('has no cycles, six generations, and no validation warnings', () => {
    expect(breakCycles(project).ignoredLinks.size).toBe(0);
    expect(generations(project).count).toBe(6);
    expect(validateProject(project, '2026-09-13')).toEqual([]);
  });
});
