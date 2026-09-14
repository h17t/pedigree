import { useState } from 'react';
import { useT } from '@/i18n';
import type { TKey } from '@/i18n';
import type { TagName } from '@/model/types';
import { MAX_GROUPS, newId } from '@/model/types';
import { transact, useAppStore } from '@/store/store';
import { announce } from '../status';

const COLOURS: TagName[] = ['green', 'amber', 'plum', 'red', 'steel', 'blue'];

/** Manage the tree's colour groups: name, colour, remove. Membership is set per person. */
export function GroupsPanel() {
  const { t } = useT();
  const project = useAppStore((s) => s.project);
  const readOnly = useAppStore((s) => s.lockState !== 'owner');
  if (!project) return null;
  const groups = project.groups;
  const count = (id: string) => Object.values(project.persons).filter((p) => p.groupId === id).length;
  return (
    <section className="panel section" aria-labelledby="sec-groups">
      <h3 id="sec-groups">{t('groups.title')}</h3>
      <p className="hint">{t('groups.intro')}</p>
      {groups.length > 0 && (
        <ul className="group-list">
          {groups.map((g, i) => (
            <li key={g.id} className="group-row">
              <span className={`tag tag-${g.color}`} aria-hidden="true">
                {g.name || t(`edit.tagColors.${g.color}` as TKey)}
              </span>
              <div className="field">
                <label htmlFor={`group-name-${g.id}`}>{t('groups.name')}</label>
                <GroupNameInput id={g.id} index={i} name={g.name} readOnly={readOnly} />
              </div>
              <div className="field">
                <label htmlFor={`group-colour-${g.id}`}>{t('groups.colour')}</label>
                <select id={`group-colour-${g.id}`} className="select" value={g.color} disabled={readOnly} onChange={(e) => transact(t('groups.title'), (d) => void (d.groups[i]!.color = e.target.value as TagName))}>
                  {COLOURS.map((c) => (
                    <option key={c} value={c}>
                      {t(`edit.tagColors.${c}` as TKey)}
                    </option>
                  ))}
                </select>
              </div>
              <span className="hint tnum">{t('groups.members', { count: count(g.id) })}</span>
              {!readOnly && (
                <button
                  type="button"
                  className="btn btn-quiet"
                  onClick={() => {
                    transact(t('groups.remove'), (d) => {
                      d.groups = d.groups.filter((x) => x.id !== g.id);
                      for (const p of Object.values(d.persons)) if (p.groupId === g.id) p.groupId = null;
                    });
                    announce(t('groups.removed', { name: g.name || t(`edit.tagColors.${g.color}` as TKey) }));
                  }}
                >
                  {t('groups.remove')}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {!readOnly && (
        <div className="btn-row">
          <button
            type="button"
            className="btn"
            disabled={groups.length >= MAX_GROUPS}
            onClick={() =>
              transact(t('groups.add'), (d) => {
                d.groups.push({ id: newId(), name: t('groups.newName', { n: d.groups.length + 1 }), color: COLOURS[d.groups.length % COLOURS.length]! });
              })
            }
          >
            {t('groups.add')}
          </button>
          {groups.length >= MAX_GROUPS && <span className="hint">{t('groups.max')}</span>}
        </div>
      )}
    </section>
  );
}

/**
 * The name is edited locally and written when the field is left (or on Enter), so renaming a
 * group is one undo step instead of one per keystroke.
 */
function GroupNameInput({ id, index, name, readOnly }: { id: string; index: number; name: string; readOnly: boolean }) {
  const { t } = useT();
  const [draft, setDraft] = useState(name);
  const [stored, setStored] = useState(name);
  // The stored name changed elsewhere (undo, another edit): take it over.
  if (stored !== name) {
    setStored(name);
    setDraft(name);
  }
  const commit = () => {
    if (draft !== name) transact(t('groups.title'), (d) => void (d.groups[index] && (d.groups[index].name = draft)));
  };
  return (
    <input
      id={`group-name-${id}`}
      className="input"
      value={draft}
      disabled={readOnly}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          commit();
        }
      }}
      autoComplete="off"
    />
  );
}
