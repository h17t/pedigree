import type { ReactNode } from 'react';
import { useT } from '@/i18n';
import type { Person, Project } from '@/model/types';

import { useAppStore } from '@/store/store';
import { PersonDetails } from '../list/PersonDetails';
import { PersonForm } from './PersonForm';
import { UnionForm } from './UnionForm';
import { FamilyPanel } from './FamilyPanel';
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
      {readOnly ? (
        <>
          <PersonDetails project={project} person={person} onSelect={onSelect} />
          <div className="btn-row">
            <button type="button" className="btn" onClick={() => openEditor({ kind: 'sheet', id: person.id })}>
              {t('sheet.open')}
            </button>
            <button type="button" className="btn" onClick={() => openEditor({ kind: 'relation', aId: person.id })}>
              {t('relation.open')}
            </button>
          </div>
        </>
      ) : (
        <>
          <PersonDetails project={project} person={person} onSelect={onSelect} relations={false} section="header" />
          <FamilyPanel project={project} person={person} onSelect={onSelect} />
          <PersonDetails project={project} person={person} onSelect={onSelect} relations={false} section="fields" />
          <div className="btn-row">
            <button type="button" className="btn" onClick={() => openEditor({ kind: 'sheet', id: person.id })}>
              {t('sheet.open')}
            </button>
            <button type="button" className="btn" onClick={() => openEditor({ kind: 'relation', aId: person.id })}>
              {t('relation.open')}
            </button>
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
