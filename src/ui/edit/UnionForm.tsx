import { useState } from 'react';
import { useT } from '@/i18n';
import type { TKey } from '@/i18n';
import type { Union, UnionStatus, UnionType } from '@/model/types';
import { personName } from '@/model/types';
import { transact, useAppStore } from '@/store/store';
import { DateField } from './DateField';
import { announce } from '../status';

const TYPES: UnionType[] = ['marriage', 'partnership', 'unmarried', 'unknown'];
const STATUSES: UnionStatus[] = ['married', 'divorced', 'widowed', 'separated', 'partnership', 'unknown'];

/** Editor for a partnership: type, status, dates, place, notes. One undo step on save. */
export function UnionForm({ union, onDone, onDelete }: { union: Union; onDone: () => void; onDelete: () => void }) {
  const { t } = useT();
  const project = useAppStore((s) => s.project)!;
  const [u, setU] = useState<Union>(() => structuredClone(union));
  const set = <K extends keyof Union>(k: K, v: Union[K]) => setU((prev) => ({ ...prev, [k]: v }));
  const names = u.partnerIds
    .map((id) => {
      const p = project.persons[id];
      return p ? personName(p) : t('common.unknown');
    })
    .join(' & ');

  const save = () => {
    transact(t('edit.editPartnership'), (d) => {
      d.unions[u.id] = u;
    });
    announce(t('edit.saved'));
    onDone();
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
      <div className="form-actions">
        <button type="submit" className="btn btn-primary btn-block">
          {t('edit.saveChanges')}
        </button>
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
