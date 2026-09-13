import { useState } from 'react';
import { useT } from '@/i18n';
import type { Person } from '@/model/types';
import { personName } from '@/model/types';
import { transact, updateUi, useAppStore } from '@/store/store';
import { addChild, addParent, addPartner, addSibling, unionsOf } from '@/model/edits';
import { openEditor } from './editorStore';
import { announce } from '../status';

/**
 * Fast entry: add partner, child, father, mother or sibling to a person. The new person is
 * created at once (one undo step) and the editor opens for them. When the person has more
 * than one partnership, the child action asks which family.
 */
export function AddMenu({ person, onAdded }: { person: Person; onAdded?: (id: string) => void }) {
  const { t } = useT();
  const project = useAppStore((s) => s.project)!;
  const readOnly = useAppStore((s) => s.lockState !== 'owner');
  const [chooseUnion, setChooseUnion] = useState(false);
  const unions = unionsOf(project, person.id);
  const hasFather = Object.values(project.childLinks).some((l) => l.childId === person.id && project.unions[l.unionId]?.partnerIds.some((p) => project.persons[p]?.sex === 'male'));
  const hasMother = Object.values(project.childLinks).some((l) => l.childId === person.id && project.unions[l.unionId]?.partnerIds.some((p) => project.persons[p]?.sex === 'female'));
  const others = Object.keys(project.persons).length - 1;
  const parentSlots = Object.values(project.childLinks).filter((l) => l.childId === person.id).reduce((n, l) => n + (project.unions[l.unionId]?.partnerIds.length ?? 0), 0);

  const nameOf = (id: string) => {
    const other = project.persons[id];
    return other ? personName(other) : t('common.unknown');
  };
  const finish = (id: string, what: string) => {
    announce(t('edit.addedPerson', { what }));
    updateUi({ selectedPersonId: id });
    openEditor({ kind: 'person', id, isNew: true });
    onAdded?.(id);
  };
  const run = (label: string, fn: (d: Parameters<Parameters<typeof transact>[1]>[0]) => string) => {
    let id = '';
    transact(t('edit.addedPerson', { what: label }), (d) => {
      id = fn(d);
    });
    if (id) finish(id, label);
  };

  if (readOnly) return null;
  return (
    <div className="add-menu" role="group" aria-label={t('edit.addMenu')}>
      <button type="button" className="btn" onClick={() => run(t('edit.what.partner'), (d) => addPartner(d, person.id, { surname: person.sex === 'female' ? '' : person.surname }).person.id)}>
        {t('edit.addPartner')}
      </button>
      {unions.length > 1 && !chooseUnion ? (
        <button type="button" className="btn" aria-expanded={false} onClick={() => setChooseUnion(true)}>
          {t('edit.addChild')}
        </button>
      ) : unions.length > 1 ? (
        <div className="add-submenu" role="group" aria-label={t('edit.addChild')}>
          {unions.map((u) => {
            const others = u.partnerIds.filter((p) => p !== person.id).map((p) => nameOf(p));
            return (
              <button key={u.id} type="button" className="btn" onClick={() => run(t('edit.what.child'), (d) => addChild(d, person.id, u.id, { surname: person.sex === 'male' ? person.surname : '' }).person.id)}>
                {others.length ? t('edit.addChildTo', { name: others.join(' & ') }) : t('edit.addChildAlone')}
              </button>
            );
          })}
          <button type="button" className="btn" onClick={() => run(t('edit.what.child'), (d) => addChild(d, person.id, null, { surname: person.surname }).person.id)}>
            {t('edit.addChildAlone')}
          </button>
        </div>
      ) : (
        <button type="button" className="btn" onClick={() => run(t('edit.what.child'), (d) => addChild(d, person.id, null, { surname: person.sex === 'female' && unions[0]?.partnerIds.length === 2 ? '' : person.surname }).person.id)}>
          {t('edit.addChild')}
        </button>
      )}
      {parentSlots < 2 && !hasFather && (
        <button type="button" className="btn" onClick={() => run(t('edit.what.father'), (d) => addParent(d, person.id, 'male', { surname: person.birthName || person.surname }).person.id)}>
          {t('edit.addFather')}
        </button>
      )}
      {parentSlots < 2 && !hasMother && (
        <button type="button" className="btn" onClick={() => run(t('edit.what.mother'), (d) => addParent(d, person.id, 'female').person.id)}>
          {t('edit.addMother')}
        </button>
      )}
      <button type="button" className="btn" onClick={() => run(t('edit.what.sibling'), (d) => addSibling(d, person.id, { surname: person.birthName || person.surname }).person.id)}>
        {t('edit.addSibling')}
      </button>
      {others > 0 && (
        <div className="add-submenu link-menu" role="group" aria-label={t('edit.linkExisting')}>
          <span className="hint">{t('edit.linkExisting')}</span>
          <button type="button" className="btn" onClick={() => openEditor({ kind: 'link', personId: person.id, role: 'partner' })}>
            {t('edit.linkAsPartner')}
          </button>
          <button type="button" className="btn" onClick={() => openEditor({ kind: 'link', personId: person.id, role: 'child' })}>
            {t('edit.linkAsChild')}
          </button>
          {parentSlots < 2 && (
            <button type="button" className="btn" onClick={() => openEditor({ kind: 'link', personId: person.id, role: 'parent' })}>
              {t('edit.linkAsParent')}
            </button>
          )}
          <button type="button" className="btn" onClick={() => openEditor({ kind: 'link', personId: person.id, role: 'sibling' })}>
            {t('edit.linkAsSibling')}
          </button>
        </div>
      )}
    </div>
  );
}
