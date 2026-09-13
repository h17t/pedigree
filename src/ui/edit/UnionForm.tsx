import { useState } from 'react';
import { useT } from '@/i18n';
import type { TKey } from '@/i18n';
import type { RelationType, Union, UnionStatus, UnionType } from '@/model/types';
import { personName } from '@/model/types';
import { transact, updateUi, useAppStore } from '@/store/store';
import { setChildRelation, unlinkPartner } from '@/model/edits';
import { unlinkChild } from '@/model/delete';
import { DateField } from './DateField';
import { announce } from '../status';
import { openEditor } from './editorStore';

const RELATIONS: RelationType[] = ['biological', 'adopted', 'step', 'foster', 'unknown'];

const TYPES: UnionType[] = ['marriage', 'partnership', 'unmarried', 'unknown'];
const STATUSES: UnionStatus[] = ['married', 'divorced', 'widowed', 'separated', 'partnership', 'unknown'];

/** Editor for a partnership: type, status, dates, place, notes. One undo step on save. */
export function UnionForm({ union, onDone, onDelete }: { union: Union; onDone: () => void; onDelete: () => void }) {
  const { t } = useT();
  const project = useAppStore((s) => s.project)!;
  const [u, setU] = useState<Union>(() => structuredClone(union));
  const [relations, setRelations] = useState<Record<string, RelationType>>({});
  const set = <K extends keyof Union>(k: K, v: Union[K]) => setU((prev) => ({ ...prev, [k]: v }));
  const nameOf = (id: string) => {
    const p = project.persons[id];
    return p ? personName(p) || t('person.unnamed') : t('common.unknown');
  };
  const names = u.partnerIds.map(nameOf).join(' & ');
  const children = Object.values(project.childLinks).filter((l) => l.unionId === union.id);

  const save = () => {
    transact(t('edit.editPartnership'), (d) => {
      d.unions[u.id] = { ...u, partnerIds: d.unions[u.id]?.partnerIds ?? u.partnerIds };
      for (const [linkId, rel] of Object.entries(relations)) setChildRelation(d, linkId, rel);
    });
    announce(t('edit.saved'));
    onDone();
  };
  const removePartner = (id: string) => {
    transact(t('edit.unlinkPartner'), (d) => unlinkPartner(d, union.id, id));
    announce(t('edit.unlinkedPartner', { name: nameOf(id) }));
    updateUi({ selectedPersonId: id });
    onDone();
  };
  const removeChild = (linkId: string, childId: string) => {
    transact(t('edit.unlinkChild'), (d) => unlinkChild(d, linkId));
    announce(t('edit.unlinkedChild', { name: nameOf(childId) }));
  };

  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <h2>{t('edit.editUnion')}</h2>
      <p className="muted">{t('edit.unionLabel', { names })}</p>
      <section className="stack-tight" aria-label={t('edit.unionPartners')}>
        <h3 className="h-small">{t('edit.unionPartners')}</h3>
        {union.partnerIds.length === 0 ? (
          <p className="muted">{t('union.partnersUnknown')}</p>
        ) : (
          <ul className="link-list">
            {union.partnerIds.map((id) => (
              <li key={id} className="link-row">
                <span>{nameOf(id)}</span>
                <button type="button" className="btn btn-quiet" onClick={() => removePartner(id)}>
                  {t('edit.unlinkPartner')}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <p className="hint">{t('edit.statusHint')}</p>
      <div className="field">
        <label htmlFor="uf-type">{t('union.type.marriage')}/{t('union.type.partnership')}</label>
        <select id="uf-type" className="select" value={u.type} onChange={(e) => set('type', e.target.value as UnionType)}>
          {TYPES.map((x) => (
            <option key={x} value={x}>
              {t(`union.type.${x}` as TKey)}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="uf-status">{t('union.status.married')}/{t('union.status.divorced')}…</label>
        <select id="uf-status" className="select" value={u.status} onChange={(e) => set('status', e.target.value as UnionStatus)}>
          {STATUSES.map((x) => (
            <option key={x} value={x}>
              {t(`union.status.${x}` as TKey)}
            </option>
          ))}
        </select>
      </div>
      <DateField id="uf-marriage" label={t('union.marriageDate')} value={u.marriageDate} qualifier={u.marriageQualifier} onChange={(v) => setU((prev) => ({ ...prev, marriageDate: v.date, marriageQualifier: v.qualifier }))} />
      <div className="field">
        <label htmlFor="uf-place">{t('union.marriagePlace')}</label>
        <input id="uf-place" className="input" value={u.marriagePlace} onChange={(e) => set('marriagePlace', e.target.value)} autoComplete="off" />
      </div>
      <DateField id="uf-divorce" label={t('union.divorceDate')} value={u.divorceDate} qualifier={u.divorceQualifier} onChange={(v) => setU((prev) => ({ ...prev, divorceDate: v.date, divorceQualifier: v.qualifier, status: v.date ? 'divorced' : prev.status }))} />
      <div className="field">
        <label htmlFor="uf-notes">{t('person.notes')}</label>
        <textarea id="uf-notes" className="textarea" value={u.notes} onChange={(e) => set('notes', e.target.value)} />
      </div>
      <section className="stack-tight" aria-label={t('edit.unionChildren')}>
        <h3 className="h-small">{t('edit.unionChildren')}</h3>
        {children.length === 0 ? (
          <p className="muted">{t('edit.unionNoChildren')}</p>
        ) : (
          <ul className="link-list">
            {children.map((l) => (
              <li key={l.id} className="link-row">
                <span>{nameOf(l.childId)}</span>
                <label className="sr-only" htmlFor={`uf-rel-${l.id}`}>
                  {t('edit.linkRelation')}
                </label>
                <select id={`uf-rel-${l.id}`} className="select select-inline" value={relations[l.id] ?? l.relationType} onChange={(e) => setRelations((r) => ({ ...r, [l.id]: e.target.value as RelationType }))}>
                  {RELATIONS.map((r) => (
                    <option key={r} value={r}>
                      {t(`person.relation.${r}` as TKey)}
                    </option>
                  ))}
                </select>
                <button type="button" className="btn btn-quiet" onClick={() => removeChild(l.id, l.childId)}>
                  {t('edit.unlinkChild')}
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="hint">{t('edit.unlinkChildHint')}</p>
        {union.partnerIds.length > 0 && (
          <div className="btn-row">
            <button type="button" className="btn" onClick={() => openEditor({ kind: 'link', personId: union.partnerIds[0]!, role: 'child', unionId: union.id })}>
              {t('edit.addExistingChild')}
            </button>
          </div>
        )}
      </section>
      <div className="form-actions">
        <button type="submit" className="btn btn-primary btn-block">
          {t('edit.saveChanges')}
        </button>
      </div>
      <div className="form-secondary">
        <div className="btn-row">
          <button type="button" className="btn" onClick={onDone}>
            {t('edit.discard')}
          </button>
          <button type="button" className="btn btn-danger" onClick={onDelete}>
            {t('edit.deleteUnionConfirm')}
          </button>
        </div>
      </div>
    </form>
  );
}
