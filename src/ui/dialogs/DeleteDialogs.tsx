import { useId, useState } from 'react';
import { useT } from '@/i18n';
import { personName } from '@/model/types';
import { transact, updateUi, useAppStore } from '@/store/store';
import { deletePerson, deleteUnion, previewDeletePerson } from '@/model/delete';
import type { UnionDeleteMode } from '@/model/delete';
import { Dialog } from '../components/Dialog';
import { announce } from '../status';
import { closeEditor } from '../edit/editorStore';

/** Confirmation for deleting one person: says exactly what else will be affected. */
export function DeletePersonDialog({ id }: { id: string }) {
  const { t } = useT();
  const project = useAppStore((s) => s.project)!;
  const person = project.persons[id];
  const descId = useId();
  if (!person) return null;
  const name = personName(person) || t('person.unnamed');
  const preview = previewDeletePerson(project, id);
  const nameOf = (pid: string) => {
    const other = project.persons[pid];
    return other ? personName(other) || t('person.unnamed') : t('common.unknown');
  };
  const confirm = () => {
    transact(t('edit.deleteConfirm', { name }), (d) => deletePerson(d, id));
    updateUi({ selectedPersonId: null });
    announce(t('edit.deleted', { name }));
    closeEditor();
  };
  return (
    <Dialog open title={t('edit.deleteTitle', { name })} onClose={closeEditor} describedBy={descId}>
      <div className="stack" id={descId}>
        <p>{t('edit.deleteIntro')}</p>
        <ul className="delete-list">
          <li>{t('edit.deleteRemovesPerson', { name })}</li>
          {preview.parentLinks.length > 0 && <li>{t('edit.deleteParentLinks', { count: preview.parentLinks.length })}</li>}
          {preview.unions.map((u) => {
            const names = u.otherPartnerIds.map(nameOf).join(' & ');
            if (u.outcome === 'removed') return <li key={u.union.id}>{names ? t('edit.deleteUnionRemoved', { names }) : t('edit.deleteUnionRemovedAlone')}</li>;
            if (u.otherPartnerIds.length === 0) return <li key={u.union.id}>{t('edit.deleteUnionKeptNoPartner', { children: t('common.people', { count: u.childCount }) })}</li>;
            return <li key={u.union.id}>{t('edit.deleteUnionKept', { names, children: u.childCount ? t('common.people', { count: u.childCount }) : t('common.none') })}</li>;
          })}
          <li>{t('edit.deleteNothingElse')}</li>
        </ul>
        <div className="btn-row btn-row-end">
          <button type="button" className="btn" onClick={closeEditor}>
            {t('common.cancel')}
          </button>
          <button type="button" className="btn btn-danger" onClick={confirm}>
            {t('edit.deleteConfirm', { name })}
          </button>
        </div>
      </div>
    </Dialog>
  );
}

/** Two clearly explained options for removing a partnership; the default keeps the children together. */
export function DeleteUnionDialog({ id }: { id: string }) {
  const { t } = useT();
  const project = useAppStore((s) => s.project)!;
  const [mode, setMode] = useState<UnionDeleteMode>('keepChildrenUnconnected');
  const union = project.unions[id];
  if (!union) return null;
  const children = Object.values(project.childLinks).filter((l) => l.unionId === id).length;
  const confirm = () => {
    transact(t('edit.deleteUnionConfirm'), (d) => deleteUnion(d, id, mode));
    announce(t('edit.deletedUnion'));
    closeEditor();
  };
  return (
    <Dialog open title={t('edit.deleteUnionTitle')} onClose={closeEditor}>
      <div className="stack">
        {children === 0 ? (
          <p>{t('edit.deleteUnionNoChildren')}</p>
        ) : (
          <fieldset className="form-section">
            <legend className="visually-hidden">{t('edit.deleteUnionTitle')}</legend>
            <div className="radio-row">
              <input id="union-delete-keep" type="radio" name="union-delete" checked={mode === 'keepChildrenUnconnected'} onChange={() => setMode('keepChildrenUnconnected')} aria-describedby="union-delete-keep-hint" />
              <span>
                <label htmlFor="union-delete-keep" className="radio-title">
                  {t('edit.deleteUnionKeep')}
                </label>
                <span className="hint" id="union-delete-keep-hint">
                  {t('edit.deleteUnionKeepHint')}
                </span>
              </span>
            </div>
            <div className="radio-row">
              <input id="union-delete-all" type="radio" name="union-delete" checked={mode === 'removeChildLinks'} onChange={() => setMode('removeChildLinks')} aria-describedby="union-delete-all-hint" />
              <span>
                <label htmlFor="union-delete-all" className="radio-title">
                  {t('edit.deleteUnionAll')}
                </label>
                <span className="hint" id="union-delete-all-hint">
                  {t('edit.deleteUnionAllHint')}
                </span>
              </span>
            </div>
          </fieldset>
        )}
        <div className="btn-row btn-row-end">
          <button type="button" className="btn" onClick={closeEditor}>
            {t('common.cancel')}
          </button>
          <button type="button" className="btn btn-danger" onClick={confirm}>
            {t('edit.deleteUnionConfirm')}
          </button>
        </div>
      </div>
    </Dialog>
  );
}

/** Deleting a multi-selection as one undoable step. */
export function DeleteManyDialog({ ids, onDone }: { ids: string[]; onDone: () => void }) {
  const { t } = useT();
  const confirm = () => {
    transact(t('edit.deleteSelected', { count: ids.length }), (d) => {
      for (const id of ids) deletePerson(d, id);
    });
    updateUi({ selectedPersonId: null });
    announce(t('edit.deleteSelected', { count: ids.length }));
    closeEditor();
    onDone();
  };
  return (
    <Dialog open title={t('edit.deleteSelected', { count: ids.length })} onClose={closeEditor}>
      <div className="stack">
        <p>{t('edit.deleteSelectedBody')}</p>
        <div className="btn-row btn-row-end">
          <button type="button" className="btn" onClick={closeEditor}>
            {t('common.cancel')}
          </button>
          <button type="button" className="btn btn-danger" onClick={confirm}>
            {t('edit.deleteSelected', { count: ids.length })}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
