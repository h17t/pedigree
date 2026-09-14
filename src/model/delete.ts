/**
 * Deletion rules (see the brief, "Deletion and merge rules"):
 *  - Deleting a person removes the person and their child links. A union is kept if it still
 *    has children (the other partner stays as a single parent); a childless union with at most
 *    one partner left is removed. Children never disappear.
 *  - Deleting a union: "keep the people and their children as unconnected" (default) or
 *    "remove the connection to the children too". People are never deleted.
 * `previewDeletePerson` describes exactly what will happen, for the confirmation dialog.
 */
import type { Draft } from 'immer';
import type { ChildLink, Project, Union } from './types';

export interface DeletePersonPreview {
  personId: string;
  /** Unions the person is a partner of, and what happens to each. */
  unions: { union: Union; outcome: 'removed' | 'kept'; childCount: number; otherPartnerIds: string[] }[];
  /** Child links from this person to their parents (removed). */
  parentLinks: ChildLink[];
  /** Children whose parent union survives without any partner (they become a "Parents unknown" group). */
  childrenLeftWithoutParents: string[];
  /** Children who stay attached to the other partner. */
  childrenStayingWithOtherParent: string[];
}

export function previewDeletePerson(project: Project, personId: string): DeletePersonPreview {
  const links = Object.values(project.childLinks);
  const unions = Object.values(project.unions)
    .filter((u) => u.partnerIds.includes(personId))
    .map((union) => {
      const children = links.filter((l) => l.unionId === union.id);
      const otherPartnerIds = union.partnerIds.filter((p) => p !== personId);
      // A childless partnership with at most one partner left is removed (same rule as unlinkPartner).
      const outcome: 'removed' | 'kept' = otherPartnerIds.length > 1 || children.length > 0 ? 'kept' : 'removed';
      return { union, outcome, childCount: children.length, otherPartnerIds };
    });
  const childrenLeftWithoutParents: string[] = [];
  const childrenStayingWithOtherParent: string[] = [];
  for (const u of unions) {
    const kids = links.filter((l) => l.unionId === u.union.id).map((l) => l.childId);
    if (u.otherPartnerIds.length === 0) childrenLeftWithoutParents.push(...kids);
    else childrenStayingWithOtherParent.push(...kids);
  }
  return { personId, unions, parentLinks: links.filter((l) => l.childId === personId), childrenLeftWithoutParents, childrenStayingWithOtherParent };
}

export function deletePerson(d: Draft<Project>, personId: string): void {
  for (const l of Object.values(d.childLinks)) if (l.childId === personId) delete d.childLinks[l.id];
  for (const u of Object.values(d.unions)) {
    if (!u.partnerIds.includes(personId)) continue;
    u.partnerIds = u.partnerIds.filter((p) => p !== personId);
    const hasChildren = Object.values(d.childLinks).some((l) => l.unionId === u.id);
    if (u.partnerIds.length <= 1 && !hasChildren) delete d.unions[u.id];
  }
  // A "parents unknown" sibling group whose last child has gone holds nothing any more.
  for (const u of Object.values(d.unions)) {
    if (u.partnerIds.length === 0 && !Object.values(d.childLinks).some((l) => l.unionId === u.id)) delete d.unions[u.id];
  }
  delete d.persons[personId];
}

export type UnionDeleteMode = 'keepChildrenUnconnected' | 'removeChildLinks';

/**
 * Delete a union. Default: the partnership is removed, the two people and the children stay
 * as people; the children lose the link to these parents either way, because the union that
 * carried the link is gone. The difference: with `keepChildrenUnconnected` the children keep
 * a zero-partner "Parents unknown" sibling group (so siblings stay siblings); with
 * `removeChildLinks` the child links are removed entirely.
 */
export function deleteUnion(d: Draft<Project>, unionId: string, mode: UnionDeleteMode): void {
  const u = d.unions[unionId];
  if (!u) return;
  const kids = Object.values(d.childLinks).filter((l) => l.unionId === unionId);
  if (mode === 'removeChildLinks' || kids.length === 0) {
    for (const l of kids) delete d.childLinks[l.id];
    delete d.unions[unionId];
  } else {
    // Keep the union as a sibling group without partners.
    u.partnerIds = [];
    u.type = 'unknown';
    u.status = 'unknown';
    u.marriageDate = null;
    u.divorceDate = null;
    u.marriagePlace = '';
  }
}

/** Remove a single child link (the child stays). */
export function unlinkChild(d: Draft<Project>, linkId: string): void {
  const l = d.childLinks[linkId];
  if (!l) return;
  delete d.childLinks[linkId];
  const u = d.unions[l.unionId];
  if (u && u.partnerIds.length === 0 && !Object.values(d.childLinks).some((x) => x.unionId === u.id)) delete d.unions[u.id];
}
