import { useState } from 'react';
import { useT } from '@/i18n';
import type { TKey } from '@/i18n';
import type { RelationType, UnionStatus } from '@/model/types';
import { personName } from '@/model/types';
import { transact, updateUi, useAppStore } from '@/store/store';
import { canLinkChild, canLinkParent, canLinkPartner, linkChild, linkParent, linkPartners, makeSiblings, unionsOf, parentUnionsOf } from '@/model/edits';
import type { LinkProblem } from '@/model/edits';
import { Dialog } from '../components/Dialog';
import { announce } from '../status';
import { closeEditor } from '../edit/editorStore';
import { searchPersons } from '../list/outline';

export type LinkRole = 'partner' | 'child' | 'parent' | 'sibling';
const STATUSES: UnionStatus[] = ['unknown', 'married', 'partnership', 'divorced', 'widowed', 'separated'];
const RELATIONS: RelationType[] = ['biological', 'adopted', 'step', 'foster', 'unknown'];

/**
 * Connect two people who already exist: as partners (a new partnership whose kind the user
 * states), as a child of one of the person's families, as a parent, or as a sibling. People
 * who cannot take the role are listed with the reason instead of being hidden.
 */
export function LinkDialog({ personId, role, unionId: presetUnion }: { personId: string; role: LinkRole; unionId?: string }) {
  const { t } = useT();
  const project = useAppStore((s) => s.project)!;
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<UnionStatus>('unknown');
  const [relation, setRelation] = useState<RelationType>('biological');
  const unions = unionsOf(project, personId);
  const [unionId, setUnionId] = useState<string | null>(presetUnion ?? (unions.length === 1 ? unions[0]!.id : null));
  const person = project.persons[personId];
  if (!person) return null;
  const name = (id: string) => {
    const p = project.persons[id];
    return p ? personName(p) || t('person.unnamed') : t('common.unknown');
  };
  const matches = query.trim() ? searchPersons(project, query).slice(0, 8) : [];

  const problem = (otherId: string): LinkProblem | null => {
    switch (role) {
      case 'partner':
        return canLinkPartner(project, personId, otherId);
      case 'child':
        return unionId ? canLinkChild(project, unionId, otherId) : otherId === personId ? 'self' : null;
      case 'parent':
        return canLinkParent(project, personId, otherId);
      case 'sibling': {
        if (otherId === personId) return 'self';
        const mine = parentUnionsOf(project, personId).map((u) => u.id);
        if (parentUnionsOf(project, otherId).some((u) => mine.includes(u.id))) return 'exists';
        return null;
      }
    }
  };

  const link = (otherId: string) => {
    const ok = transact(t('edit.linkLabel', { name: name(otherId) }), (d) => {
      if (role === 'partner') linkPartners(d, personId, otherId, status);
      else if (role === 'parent') linkParent(d, personId, otherId);
      else if (role === 'sibling') makeSiblings(d, personId, otherId);
      else {
        // Child: use the chosen family, or create one for a person without partnerships.
        let target = unionId;
        if (!target) {
          const r = linkParent(d, otherId, personId);
          target = r.id;
          return;
        }
        linkChild(d, target, otherId, relation);
      }
    });
    if (ok) {
      announce(t('edit.linked', { a: name(personId), b: name(otherId) }));
      updateUi({ selectedPersonId: personId });
    }
    closeEditor();
  };

  const needsFamily = role === 'child' && unions.length > 1 && !unionId;

  return (
    <Dialog open title={t(`edit.linkTitle.${role}` as TKey, { name: name(personId) })} onClose={closeEditor}>
      <div className="stack">
        {role === 'partner' && (
          <div className="field">
            <label htmlFor="link-status">{t('edit.linkStatus')}</label>
            <select id="link-status" className="select" value={status} onChange={(e) => setStatus(e.target.value as UnionStatus)}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s === 'unknown' ? t('wizard.statusNotRecorded') : t(`union.status.${s}` as TKey)}
                </option>
              ))}
            </select>
          </div>
        )}
        {role === 'child' && unions.length > 1 && (
          <div className="field">
            <label htmlFor="link-family">{t('edit.linkFamily')}</label>
            <select id="link-family" className="select" value={unionId ?? ''} onChange={(e) => setUnionId(e.target.value || null)}>
              <option value="">{t('edit.linkFamily')}</option>
              {unions.map((u) => {
                const others = u.partnerIds.filter((p) => p !== personId).map(name);
                return (
                  <option key={u.id} value={u.id}>
                    {others.length ? t('edit.addChildTo', { name: others.join(' & ') }) : t('edit.addChildAlone')}
                  </option>
                );
              })}
            </select>
          </div>
        )}
        {role === 'child' && (
          <div className="field">
            <label htmlFor="link-relation">{t('edit.linkRelation')}</label>
            <select id="link-relation" className="select" value={relation} onChange={(e) => setRelation(e.target.value as RelationType)}>
              {RELATIONS.map((r) => (
                <option key={r} value={r}>
                  {t(`person.relation.${r}` as TKey)}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="field">
          <label htmlFor="link-search">{t('edit.linkSearch')}</label>
          <input id="link-search" className="input" type="search" value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off" aria-describedby="link-hint" />
          <p className="hint" id="link-hint">
            {t('edit.linkHint')}
          </p>
        </div>
        <ul className="link-list">
          {matches.map((id) => {
            const why = needsFamily ? null : problem(id);
            return (
              <li key={id}>
                {why ? (
                  <p className="muted">
                    {name(id)} · {t(`edit.linkReason.${why}` as TKey)}
                  </p>
                ) : (
                  <button type="button" className="btn btn-block" disabled={needsFamily} onClick={() => link(id)}>
                    {t('edit.linkPick', { name: name(id) })}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </Dialog>
  );
}
