/**
 * Name search over the people of a tree: accent- and case-insensitive, matching every word
 * of the query against given names, surname, birth name and nickname.
 */
import type { Project } from '@/model/types';
import { personName } from '@/model/types';

export function normalizeForSearch(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/ß/g, 'ss');
}

export function searchPersons(project: Project, query: string): string[] {
  const q = normalizeForSearch(query.trim());
  if (!q) return [];
  return Object.values(project.persons)
    .filter((p) => normalizeForSearch([p.titlePrefix, p.givenNames, p.surname, p.birthName, p.nickname].join(' ')).includes(q))
    .sort((a, b) => personName(a).localeCompare(personName(b)))
    .map((p) => p.id);
}
