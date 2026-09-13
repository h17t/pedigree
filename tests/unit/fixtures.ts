import { createChildLink, createPerson, createProject, createUnion } from '@/model/types';
import type { Person, Project, RelationType, Union } from '@/model/types';

/** Small builder for readable test trees. */
export function build() {
  const project = createProject('test');
  const api = {
    project,
    person(givenNames: string, extra: Partial<Person> = {}): Person {
      const p = createPerson({ givenNames, surname: 'Test', ...extra });
      project.persons[p.id] = p;
      return p;
    },
    union(partners: Person[], extra: Partial<Union> = {}): Union {
      const u = createUnion({ partnerIds: partners.map((p) => p.id), type: 'marriage', status: 'married', ...extra });
      project.unions[u.id] = u;
      return u;
    },
    child(union: Union, child: Person, rel: RelationType = 'biological') {
      const l = createChildLink(union.id, child.id, rel);
      project.childLinks[l.id] = l;
      return l;
    },
    family(parents: Person[], children: Person[]): Union {
      const u = api.union(parents);
      for (const c of children) api.child(u, c);
      return u;
    },
  };
  return api;
}

export const born = (date: string | null): Partial<Person> => ({ birth: { date, qualifier: 'exact', place: '', note: '' } });
export const died = (date: string | null): Partial<Person> => ({ death: { date, qualifier: 'exact', place: '', note: '', cause: '' } });
export type { Project };
