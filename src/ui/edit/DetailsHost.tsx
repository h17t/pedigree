import type { ReactNode } from 'react';
import { useT } from '@/i18n';
import type { Person, Project } from '@/model/types';
import { personName } from '@/model/types';
import { useAppStore } from '@/store/store';
import { unionsOf } from '@/model/edits';
import { PersonDetails } from '../list/PersonDetails';
import { PersonForm } from './PersonForm';
import { UnionForm } from './UnionForm';
import { AddMenu } from './AddMenu';
import { closeEditor, openEditor, useEditor } from './editorStore';

/**
 * The right-hand column (laptop) or the sheet (phone): shows the selected person's details
 * with the editing actions, or the person/union editor when one is open.
 */
export function DetailsHost({ project, person, onSelect, extra }: { project: Project; person: Person | undefined; onSelect: (id: string) => void; extra?: ReactNode }) {
  const { t } = useT();
  const editor = useEditor((s) => s.state);
  const readOnly = useAppStore((s) => s.lockState !== 'owner');

  if (editor.kind === 'person' && project.persons[editor.id]) {
    const p = project.persons[editor.id]!;
    return <PersonForm key={p.id} person={p} isNew={editor.isNew} onDone={closeEditor} onDelete={() => openEditor({ kind: 'deletePerson', id: p.id })} />;
  }
  if (editor.kind === 'union' && project.unions[editor.id]) {
    const u = project.unions[editor.id]!;
    return <UnionForm key={u.id} union={u} onDone={closeEditor} onDelete={() => openEditor({ kind: 'deleteUnion', id: u.id })} />;
  }
  if (!person) return <p className="muted">{t('tree.noSelection')}</p>;

  const unions = unionsOf(project, person.id);
  return (
    <div className="stack">
      {!readOnly && (
        <div className="btn-row details-actions">
          <button type="button" className="btn btn-primary" onClick={() => openEditor({ kind: 'person', id: person.id, isNew: false })}>
            {t('edit.editPerson')}
          </button>
          <button type="button" className="btn btn-danger" onClick={() => openEditor({ kind: 'deletePerson', id: person.id })}>
            {t('common.delete')}
          </button>
        </div>
      )}
      <PersonDetails project={project} person={person} onSelect={onSelect} />
      {!readOnly && (
        <>
          <h3>{t('edit.addMenu')}</h3>
          <AddMenu person={person} />
          {unions.length > 0 && (
            <>
              <h3>{t('person.partners')}</h3>
              <div className="btn-row">
                {unions.map((u) => {
                  const others = u.partnerIds.filter((p) => p !== person.id).map((p) => {
                    const other = project.persons[p];
                    return other ? personName(other) : t('common.unknown');
                  });
                  return (
                    <button key={u.id} type="button" className="btn" onClick={() => openEditor({ kind: 'union', id: u.id })}>
                      {others.length ? t('edit.partnershipWith', { name: others.join(' & ') }) : t('edit.editPartnership')}
                    </button>
                  );
                })}
              </div>
            </>
          )}
          <div className="btn-row">
            <button type="button" className="btn" onClick={() => openEditor({ kind: 'merge', aId: person.id, bId: null })}>
              {t('edit.merge')}
            </button>
          </div>
        </>
      )}
      {readOnly && <p className="hint">{t('edit.readOnly')}</p>}
      {extra}
    </div>
  );
}
