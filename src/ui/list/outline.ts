/**
 * Name search over the people of a tree: accent- and case-insensitive, matching every word
 * of the query against given names, surname, birth name and nickname.
 */
import type { Project } from '@/model/types';
import { personName } from '@/model/types';

export { normalizeForSearch } from '@/model/search';

import { normalizeForSearch as norm } from '@/model/search';

export function searchPersons(project: Project, query: string): string[] {
  const q = norm(query.trim());
  if (!q) return [];
  return Object.values(project.persons)
    .filter((p) => norm([p.titlePrefix, p.givenNames, p.surname, p.birthName, p.nickname].join(' ')).includes(q))
    .sort((a, b) => personName(a).localeCompare(personName(b)))
    .map((p) => p.id);
}
