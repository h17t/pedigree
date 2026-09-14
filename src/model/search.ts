/**
 * Search across every field of a person and the filters of the search panel. Pure functions;
 * the result is a list of ids sorted by name.
 */
import type { Project } from '@/model/types';
import { personName } from '@/model/types';
import { yearOf } from '@/model/dates';
import { parentUnionsOf } from '@/model/edits';

export interface SearchCriteria {
  text: string;
  missingBirth: boolean;
  missingDeath: boolean;
  missingParents: boolean;
  bornFrom: string;
  bornTo: string;
  place: string;
}

export const emptyCriteria = (): SearchCriteria => ({ text: '', missingBirth: false, missingDeath: false, missingParents: false, bornFrom: '', bornTo: '', place: '' });

export function isEmptyCriteria(c: SearchCriteria): boolean {
  return !c.text.trim() && !c.missingBirth && !c.missingDeath && !c.missingParents && !c.bornFrom.trim() && !c.bornTo.trim() && !c.place.trim();
}

export function normalizeForSearch(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/ß/g, 'ss');
}

/** Everything about a person as one searchable string. */
export function haystack(p: Project['persons'][string]): string {
  return normalizeForSearch(
    [
      p.titlePrefix, p.givenNames, p.surname, p.birthName, p.nickname,
      p.birth.place, p.birth.note, p.death.place, p.death.note, p.death.cause,
      p.occupation, p.religion, p.residence, p.notes, p.sources,
      ...p.events.flatMap((e) => [e.label, e.place, e.note]),
      ...p.customFields.flatMap((f) => [f.label, f.value]),
    ].join(' '),
  );
}

export function searchAll(project: Project, c: SearchCriteria): string[] {
  const words = normalizeForSearch(c.text.trim()).split(/\s+/).filter(Boolean);
  const place = normalizeForSearch(c.place.trim());
  const from = c.bornFrom.trim() ? Number(c.bornFrom.trim()) : null;
  const to = c.bornTo.trim() ? Number(c.bornTo.trim()) : null;
  return Object.values(project.persons)
    .filter((p) => {
      if (words.length) {
        const h = haystack(p);
        if (!words.every((w) => h.includes(w))) return false;
      }
      if (c.missingBirth && p.birth.date) return false;
      if (c.missingDeath && !(p.lifeStatus === 'deceased' && !p.death.date)) return false;
      if (c.missingParents && parentUnionsOf(project, p.id).some((u) => u.partnerIds.length > 0)) return false;
      if (from !== null || to !== null) {
        const y = p.birth.date ? Number(yearOf(p.birth.date)) : NaN;
        if (Number.isNaN(y)) return false;
        if (from !== null && !Number.isNaN(from) && y < from) return false;
        if (to !== null && !Number.isNaN(to) && y > to) return false;
      }
      if (place) {
        const places = normalizeForSearch([p.birth.place, p.death.place, p.residence, ...p.events.map((e) => e.place)].join(' | '));
        if (!places.includes(place)) return false;
      }
      return true;
    })
    .sort((a, b) => personName(a).localeCompare(personName(b)))
    .map((p) => p.id);
}
