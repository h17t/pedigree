import { useT } from '@/i18n';
import type { TKey } from '@/i18n';
import type { Person, Project, Union } from '@/model/types';
import { personName } from '@/model/types';
import { formatDateWithQualifier } from '@/model/dates';
import { transact, updateUi, useAppStore } from '@/store/store';
import { addChild, addParent, addPartner, addSibling, parentUnionsOf, removeParent, unionsOf, unlinkPartner } from '@/model/edits';
import { unlinkChild } from '@/model/delete';
import { openEditor } from './editorStore';
import { announce } from '../status';

/**
 * The one place to edit a person's relationships. It shows the slots (father, mother, each
 * partner with the children of that partnership, siblings) and, next to every slot, the two
 * ways to fill it: "New person" or "Choose existing". Removing a link never deletes anyone.
 */
export function FamilyPanel({ project, person, onSelect }: { project: Project; person: Person; onSelect: (id: string) => void }) {
  const { t, locale } = useT();
  const readOnly = useAppStore((s) => s.lockState !== 'owner');
  const name = (id: string) => {
    const p = project.persons[id];
    return p ? personName(p) || t('person.unnamed') : t('common.unknown');
  };
  const parentUnions = parentUnionsOf(project, person.id);
  const parents = parentUnions.flatMap((u) => u.partnerIds.map((pid) => ({ pid, union: u })));
  const father = parents.find((x) => project.persons[x.pid]?.sex === 'male');
  const mother = parents.find((x) => project.persons[x.pid]?.sex === 'female');
  const otherParents = parents.filter((x) => x !== father && x !== mother);
  const parentSlotFree = parents.length < 2;
  const partnerUnions = unionsOf(project, person.id);
  const siblings = [...new Set(parentUnions.flatMap((u) => Object.values(project.childLinks).filter((l) => l.unionId === u.id && l.childId !== person.id).map((l) => l.childId)))];
  const childLinksOf = (u: Union) => Object.values(project.childLinks).filter((l) => l.unionId === u.id);
  const unionInfo = (u: Union) => {
    const status = u.status !== 'unknown' ? t(`union.status.${u.status}` as TKey) : u.type !== 'unknown' ? t(`union.type.${u.type}` as TKey) : t('family.notRecorded');
    const when = u.marriageDate ? formatDateWithQualifier(locale, u.marriageDate, u.marriageQualifier) : '';
    const until = u.divorceDate ? formatDateWithQualifier(locale, u.divorceDate, u.divorceQualifier) : '';
    return [status, when, until ? `${t('union.divorceDate')}: ${until}` : ''].filter(Boolean).join(' · ');
  };

  const created = (id: string, what: string) => {
    announce(t('edit.addedPerson', { what }));
    updateUi({ selectedPersonId: id });
    openEditor({ kind: 'person', id, isNew: true });
  };
  const addNew = (what: TKey, fn: (d: Parameters<Parameters<typeof transact>[1]>[0]) => string) => {
    let id = '';
    transact(t('edit.addedPerson', { what: t(what) }), (d) => {
      id = fn(d);
    });
    if (id) created(id, t(what));
  };
  const link = (role: 'partner' | 'child' | 'parent' | 'sibling', unionId?: string) => openEditor({ kind: 'link', personId: person.id, role, unionId });
  const others = Object.keys(project.persons).length - 1;

  const choice = (label: string, onNew: () => void, onExisting: () => void) => (
    <span className="family-actions" role="group" aria-label={label}>
      <button type="button" className="btn btn-sm" onClick={onNew}>
        {t('family.newPerson')}
      </button>
      {others > 0 && (
        <button type="button" className="btn btn-sm" onClick={onExisting}>
          {t('family.chooseExisting')}
        </button>
      )}
    </span>
  );
  const personLink = (id: string) => (
    <button type="button" className="link-btn" onClick={() => onSelect(id)}>
      {name(id)}
    </button>
  );
  const parentRow = (label: string, sex: 'male' | 'female', slot: { pid: string; union: Union } | undefined) => (
    <div className="family-row" role="group" aria-label={label}>
      <span className="family-label">{label}</span>
      {slot ? (
        <>
          {personLink(slot.pid)}
          {!readOnly && (
            <button
              type="button"
              className="btn btn-sm btn-quiet"
              onClick={() => {
                transact(t('family.removeParentLabel', { name: name(slot.pid) }), (d) => removeParent(d, person.id, slot.pid));
                announce(t('family.removedParent', { name: name(slot.pid), child: name(person.id) }));
              }}
            >
              {t('family.remove')}
            </button>
          )}
        </>
      ) : (
        <>
          <span className="muted">{t('family.notRecorded')}</span>
          {!readOnly && parentSlotFree && choice(t('family.addSlot', { slot: label }), () => addNew(sex === 'male' ? 'edit.what.father' : 'edit.what.mother', (d) => addParent(d, person.id, sex, { surname: sex === 'male' ? person.birthName || person.surname : '' }).person.id), () => link('parent'))}
        </>
      )}
    </div>
  );

  return (
    <section className="family-panel" aria-label={t('family.titleOf', { name: name(person.id) })}>
      <h3>{t('family.title')}</h3>

      <div className="family-group">
        <h4 className="family-heading">{t('family.parents')}</h4>
        {parentRow(t('family.father'), 'male', father)}
        {parentRow(t('family.mother'), 'female', mother)}
        {otherParents.map((x) => (
          <div key={x.pid} className="family-row" role="group" aria-label={t('family.parent')}>
            <span className="family-label">{t('family.parent')}</span>
            {personLink(x.pid)}
            {!readOnly && (
              <button
                type="button"
                className="btn btn-sm btn-quiet"
                onClick={() => {
                  transact(t('family.removeParentLabel', { name: name(x.pid) }), (d) => removeParent(d, person.id, x.pid));
                  announce(t('family.removedParent', { name: name(x.pid), child: name(person.id) }));
                }}
              >
                {t('family.remove')}
              </button>
            )}
          </div>
        ))}
        {parentUnions
          .filter((u) => u.partnerIds.length === 2)
          .map((u) => (
            <div key={u.id} className="family-row" role="group" aria-label={t('family.parentsRelationship')}>
              <span className="family-label">{t('family.parentsRelationship')}</span>
              <span className={u.status === 'unknown' && u.type === 'unknown' ? 'muted' : ''}>{unionInfo(u)}</span>
              {!readOnly && (
                <button type="button" className="btn btn-sm" onClick={() => openEditor({ kind: 'union', id: u.id })}>
                  {t('family.edit')}
                </button>
              )}
            </div>
          ))}
      </div>

      <div className="family-group">
        <h4 className="family-heading">{t('family.partnersAndChildren')}</h4>
        {partnerUnions.length === 0 && <p className="muted">{t('family.noPartner')}</p>}
        {partnerUnions.map((u) => {
          const partnerIds = u.partnerIds.filter((p) => p !== person.id);
          const kids = childLinksOf(u);
          const partnerLabel = partnerIds.length ? partnerIds.map(name).join(' & ') : t('family.partnerUnknown');
          return (
            <div key={u.id} className="family-union" role="group" aria-label={t('family.partnershipWith', { name: partnerLabel })}>
              <div className="family-row">
                <span className="family-label">{t('family.partner')}</span>
                {partnerIds.length ? partnerIds.map((pid) => <span key={pid}>{personLink(pid)}</span>) : <span className="muted">{t('family.partnerUnknown')}</span>}
                <span className="muted small">{unionInfo(u)}</span>
                {!readOnly && (
                  <>
                    <button type="button" className="btn btn-sm" onClick={() => openEditor({ kind: 'union', id: u.id })}>
                      {t('family.edit')}
                    </button>
                    {partnerIds.map((pid) => (
                      <button
                        key={pid}
                        type="button"
                        className="btn btn-sm btn-quiet"
                        onClick={() => {
                          transact(t('edit.unlinkPartner'), (d) => unlinkPartner(d, u.id, pid));
                          announce(t('edit.unlinkedPartner', { name: name(pid) }));
                        }}
                      >
                        {t('family.remove')}
                      </button>
                    ))}
                  </>
                )}
              </div>
              <div className="family-row family-children">
                <span className="family-label">{t('family.children')}</span>
                <span className="family-list">
                  {kids.length === 0 && <span className="muted">{t('family.noChildren')}</span>}
                  {kids.map((l) => (
                    <span key={l.id} className="family-child">
                      {personLink(l.childId)}
                      {l.relationType !== 'biological' && <span className="muted small"> ({t(`person.relation.${l.relationType}` as TKey)})</span>}
                      {!readOnly && (
                        <button
                          type="button"
                          className="btn btn-sm btn-quiet"
                          aria-label={t('family.removeChildAria', { name: name(l.childId) })}
                          onClick={() => {
                            transact(t('edit.unlinkChild'), (d) => unlinkChild(d, l.id));
                            announce(t('edit.unlinkedChild', { name: name(l.childId) }));
                          }}
                        >
                          {t('family.remove')}
                        </button>
                      )}
                    </span>
                  ))}
                </span>
                {!readOnly && choice(t('family.addChildTo', { name: partnerLabel }), () => addNew('edit.what.child', (d) => addChild(d, person.id, u.id, { surname: person.sex === 'male' ? person.surname : '' }).person.id), () => link('child', u.id))}
              </div>
            </div>
          );
        })}
        {!readOnly && (
          <div className="family-row">
            <span className="family-label">{t('family.addPartner')}</span>
            {choice(t('family.addPartner'), () => addNew('edit.what.partner', (d) => addPartner(d, person.id, { surname: person.sex === 'female' ? '' : person.surname }).person.id), () => link('partner'))}
          </div>
        )}
        {!readOnly && partnerUnions.length === 0 && (
          <div className="family-row">
            <span className="family-label">{t('family.addChildAlone')}</span>
            {choice(t('family.addChildAlone'), () => addNew('edit.what.child', (d) => addChild(d, person.id, null, { surname: person.surname }).person.id), () => link('child'))}
          </div>
        )}
      </div>

      <div className="family-group">
        <h4 className="family-heading">{t('family.siblings')}</h4>
        <div className="family-row">
          <span className="family-list">
            {siblings.length === 0 && <span className="muted">{t('common.none')}</span>}
            {siblings.map((id) => (
              <span key={id}>{personLink(id)}</span>
            ))}
          </span>
          {!readOnly && choice(t('family.addSibling'), () => addNew('edit.what.sibling', (d) => addSibling(d, person.id, { surname: person.birthName || person.surname }).person.id), () => link('sibling'))}
        </div>
      </div>
    </section>
  );
}
