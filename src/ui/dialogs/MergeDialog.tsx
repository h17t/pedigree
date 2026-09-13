import { useState } from 'react';
import { useT } from '@/i18n';
import type { TKey } from '@/i18n';
import { personName } from '@/model/types';
import { transact, updateUi, useAppStore } from '@/store/store';
import { MERGE_FIELDS, MERGE_EVENT_FIELDS, conflictingFields, fieldValue, mergePersons } from '@/model/merge';
import type { MergeChoice, MergeField } from '@/model/merge';
import { Dialog } from '../components/Dialog';
import { announce } from '../status';
import { closeEditor, openEditor } from '../edit/editorStore';
import { searchPersons } from '../list/outline';

const FIELD_LABEL: Record<MergeField, TKey> = {
  givenNames: 'person.givenNames', surname: 'person.surname', birthName: 'person.birthName', nickname: 'person.nickname', titlePrefix: 'person.titlePrefix',
  sex: 'person.sex', lifeStatus: 'person.lifeStatus', occupation: 'person.occupation', religion: 'person.religion', residence: 'person.residence',
  sources: 'person.sources', notes: 'person.notes', tag: 'person.tag', birth: 'person.birth', death: 'person.death',
};

/**
 * Side-by-side comparison of two people. Per field the user picks which value wins; conflicts
 * can be kept in the notes; everything from both records is re-pointed to the survivor.
 */
export function MergeDialog({ aId, bId }: { aId: string; bId: string | null }) {
  const { t } = useT();
  const project = useAppStore((s) => s.project)!;
  const [query, setQuery] = useState('');
  const [choices, setChoices] = useState<Partial<Record<MergeField, MergeChoice>>>({});
  const [keep, setKeep] = useState(true);
  const a = project.persons[aId];
  const b = bId ? project.persons[bId] : undefined;
  if (!a) return null;
  const name = (p: typeof a) => personName(p) || t('person.unnamed');

  if (!b) {
    const matches = query.trim() ? searchPersons(project, query).filter((id) => id !== aId).slice(0, 8) : [];
    return (
      <Dialog open title={t('edit.mergeTitle')} onClose={closeEditor}>
        <div className="stack">
          <p>{t('edit.mergeOther')}</p>
          <div className="field">
            <label htmlFor="merge-search">{t('edit.mergeSearch')}</label>
            <input id="merge-search" className="input" type="search" value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off" />
          </div>
          <ul className="link-list">
            {matches.map((id) => (
              <li key={id}>
                <button type="button" className="btn btn-block" onClick={() => openEditor({ kind: 'merge', aId, bId: id })}>
                  {name(project.persons[id]!)}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </Dialog>
    );
  }

  const conflicts = conflictingFields(a, b);
  const all: MergeField[] = [...MERGE_FIELDS, ...MERGE_EVENT_FIELDS];
  const rows = all.filter((f) => fieldValue(a, f) !== '' || fieldValue(b, f) !== '');
  const confirm = () => {
    transact(t('edit.mergeConfirm'), (d) => mergePersons(d, { survivorId: aId, loserId: b.id, choices, keepConflictsInNotes: keep }, { mergedFrom: t('edit.mergedFrom') }));
    updateUi({ selectedPersonId: aId });
    announce(t('edit.merged', { a: name(a), b: name(b) }));
    closeEditor();
  };

  return (
    <Dialog open title={t('edit.mergeTitle')} onClose={closeEditor}>
      <div className="stack">
        <p>{t('edit.mergeIntro')}</p>
        {conflicts.length === 0 && <p className="hint">{t('edit.mergeNoDifferences')}</p>}
        <div className="table-wrap">
          <table className="table merge-table">
            <thead>
              <tr>
                <th scope="col">{t('edit.field')}</th>
                <th scope="col">{t('edit.thisRecord')}: {name(a)}</th>
                <th scope="col">{t('edit.otherRecord')}: {name(b)}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((f) => {
                const va = fieldValue(a, f), vb = fieldValue(b, f);
                const conflict = conflicts.includes(f);
                const current = choices[f] ?? (va === '' && vb !== '' ? 'b' : 'a');
                return (
                  <tr key={f}>
                    <th scope="row">{t(FIELD_LABEL[f])}</th>
                    {conflict ? (
                      <>
                        <td>
                          <label className="radio-row">
                            <input type="radio" name={`merge-${f}`} checked={current === 'a'} onChange={() => setChoices((c) => ({ ...c, [f]: 'a' }))} />
                            <span>{va}</span>
                          </label>
                        </td>
                        <td>
                          <label className="radio-row">
                            <input type="radio" name={`merge-${f}`} checked={current === 'b'} onChange={() => setChoices((c) => ({ ...c, [f]: 'b' }))} />
                            <span>{vb}</span>
                          </label>
                        </td>
                      </>
                    ) : (
                      <>
                        <td>{va || <span className="muted">—</span>}</td>
                        <td>{vb === va ? <span className="muted">{t('edit.same')}</span> : vb || <span className="muted">—</span>}</td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <label className="radio-row">
          <input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} />
          <span>{t('edit.mergeKeep')}</span>
        </label>
        <div className="btn-row btn-row-end">
          <button type="button" className="btn" onClick={closeEditor}>
            {t('common.cancel')}
          </button>
          <button type="button" className="btn btn-primary" onClick={confirm}>
            {t('edit.mergeConfirm')}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
