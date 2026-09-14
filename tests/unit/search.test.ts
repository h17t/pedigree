import { describe, expect, it } from 'vitest';
import { searchAll, emptyCriteria, isEmptyCriteria } from '@/model/search';
import { build, born } from './fixtures';

describe('searchAll', () => {
  it('matches every word across all fields and applies the completeness filters', () => {
    const b = build();
    const a = b.person('Anna', { surname: 'Weber', ...born('1950-03-02'), occupation: 'Lehrerin', birth: { date: '1950-03-02', qualifier: 'exact', place: 'Speyer', note: '' } });
    const k = b.person('Karl', { surname: 'Weber', occupation: 'Winzer', notes: 'Weingut in Landau', lifeStatus: 'deceased' });
    const m = b.person('Maria', { surname: 'Koch', ...born('1975'), customFields: [{ label: 'Verein', value: 'Chor Speyer' }] });
    const p = b.person('Paul', { surname: 'Koch', ...born('1940'), death: { date: '2000', qualifier: 'exact', place: '', note: '', cause: '' }, lifeStatus: 'deceased' });
    b.family([p], [m]);
    const ids = (c: Partial<ReturnType<typeof emptyCriteria>>) => searchAll(b.project, { ...emptyCriteria(), ...c }).map((id) => b.project.persons[id]!.givenNames);
    expect(isEmptyCriteria(emptyCriteria())).toBe(true);
    expect(ids({ text: 'speyer' })).toEqual(['Anna', 'Maria']); // place and custom field
    expect(ids({ text: 'weber winzer' })).toEqual(['Karl']); // every word must match
    expect(ids({ text: 'landau' })).toEqual(['Karl']); // notes
    expect(ids({ missingBirth: true })).toEqual(['Karl']);
    expect(ids({ missingDeath: true })).toEqual(['Karl']); // deceased without a date; Paul has one
    expect(ids({ missingParents: true }).sort()).toEqual(['Anna', 'Karl', 'Paul']);
    expect(ids({ bornFrom: '1945', bornTo: '1960' })).toEqual(['Anna']);
    expect(ids({ bornFrom: '1970' })).toEqual(['Maria']);
    expect(ids({ place: 'spey' })).toEqual(['Anna']); // birth place only, not the custom field
    expect(ids({ text: 'koch', bornTo: '1950' })).toEqual(['Paul']);
    expect(ids({ text: 'nobody' })).toEqual([]);
    expect(a.id && k.id).toBeTruthy();
  });
});
