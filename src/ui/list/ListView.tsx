import { useMemo, useState } from 'react';
import { useT } from '@/i18n';
import type { Project } from '@/model/types';
import { displayName } from '@/model/types';
import { formatYearWithQualifier } from '@/model/dates';
import { useAppStore, updateUi, transact } from '@/store/store';
import { addPerson } from '@/model/edits';
import { DetailsHost } from '../edit/DetailsHost';
import { closeEditor, useEditor, openEditor } from '../edit/editorStore';
import { searchPersons } from './outline';
import { useIsDesktop } from '../hooks';

/**
 * List mode: everyone in the tree, alphabetical by surname, with search. Choosing a person
 * shows their details and the Family panel (on the right on laptops, as a sheet on phones).
 * Relationships are read and edited there, not in the list itself.
 */
export function ListView() {
  const { t, locale } = useT();
  const project = useAppStore((s) => s.project);
  const selectedId = useAppStore((s) => s.ui.selectedPersonId);
  const [query, setQuery] = useState('');
  const isDesktop = useIsDesktop();
  const [sheetOpen, setSheetOpen] = useState(false);
  const editor = useEditor((s) => s.state);
  const editing = editor.kind === 'person' || editor.kind === 'union';
  const readOnly = useAppStore((s) => s.lockState !== 'owner');

  const groups = useMemo(() => {
    if (!project) return [];
    const collator = new Intl.Collator(locale, { sensitivity: 'base' });
    const ids = Object.keys(project.persons).sort((a, b) => {
      const pa = project.persons[a]!, pb = project.persons[b]!;
      return collator.compare(pa.surname.trim(), pb.surname.trim()) || collator.compare(pa.givenNames.trim(), pb.givenNames.trim());
    });
    const out: { letter: string; ids: string[] }[] = [];
    for (const id of ids) {
      const surname = project.persons[id]!.surname.trim();
      const letter = surname ? surname[0]!.toLocaleUpperCase(locale) : '';
      const last = out[out.length - 1];
      if (last && last.letter === letter) last.ids.push(id);
      else out.push({ letter, ids: [id] });
    }
    // People without a surname go last.
    return [...out.filter((g) => g.letter !== ''), ...out.filter((g) => g.letter === '')];
  }, [project, locale]);

  if (!project) return null;
  const selected = selectedId ? project.persons[selectedId] : undefined;

  const select = (id: string) => {
    updateUi({ selectedPersonId: id });
    if (!isDesktop) setSheetOpen(true);
  };
  const matches = query.trim() ? searchPersons(project, query) : null;
  const total = Object.keys(project.persons).length;

  const details = <DetailsHost project={project} person={selected} onSelect={select} />;
  const addNewPerson = () => {
    let id = '';
    transact(t('edit.addedPerson', { what: t('edit.what.person') }), (d) => {
      id = addPerson(d).id;
    });
    updateUi({ selectedPersonId: id });
    openEditor({ kind: 'person', id, isNew: true });
    if (!isDesktop) setSheetOpen(true);
  };

  return (
    <div className="list-view">
      <div className="list-head">
        <h2>{t('list.title')}</h2>
        <p className="muted">{t('list.intro')}</p>
        {!readOnly && (
          <div className="btn-row">
            <button type="button" className="btn btn-primary" onClick={addNewPerson}>
              {t('edit.addPerson')}
            </button>
          </div>
        )}
      </div>
      <div className="field">
        <label htmlFor="person-search">{t('list.searchLabel')}</label>
        <input id="person-search" className="input" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('list.searchPlaceholder')} autoComplete="off" />
        {matches && (
          <p className="hint" role="status">
            {matches.length === 0 ? t('list.noMatches', { query: query.trim() }) : t('list.matches', { count: matches.length })}
          </p>
        )}
      </div>

      {total === 0 ? (
        <p className="muted">{t('list.empty')}</p>
      ) : matches ? (
        <ul className="people-list" aria-label={t('common.search')}>
          {matches.map((id) => (
            <li key={id}>
              <PersonButton project={project} id={id} selected={id === selectedId} onSelect={select} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="people-groups">
          <p className="hint tnum">{t('common.people', { count: total })}</p>
          {groups.map((g) => (
            <section key={g.letter || '#'} className="people-group" aria-label={g.letter ? t('list.letter', { letter: g.letter }) : t('list.noSurname')}>
              <h3 className="people-letter">{g.letter || t('list.noSurname')}</h3>
              <ul className="people-list">
                {g.ids.map((id) => (
                  <li key={id}>
                    <PersonButton project={project} id={id} selected={id === selectedId} onSelect={select} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {!isDesktop && (sheetOpen || editing) && (selected || editing) && (
        <div className="sheet" role="dialog" aria-modal="true" aria-label={editing ? t('edit.editTitle') : t('person.details')}>
          <div className="sheet-head">
            <button
              type="button"
              className="btn btn-quiet"
              onClick={() => {
                if (editing) closeEditor();
                else setSheetOpen(false);
              }}
            >
              {t('common.back')}
            </button>
            <span className="sheet-title">{editing ? t('edit.editTitle') : t('person.details')}</span>
          </div>
          <div className="sheet-body">{details}</div>
        </div>
      )}
      {isDesktop && (
        <aside className="list-details-desktop" aria-label={t('person.details')}>
          {details}
        </aside>
      )}
    </div>
  );
}


function PersonButton({ project, id, selected, onSelect }: { project: Project; id: string; selected: boolean; onSelect: (id: string) => void }) {
  const { t } = useT();
  const p = project.persons[id];
  if (!p) return null;
  const birthYear = p.birth.date ? `* ${formatYearWithQualifier(p.birth)}` : '';
  const deathYear = p.death.date ? `† ${formatYearWithQualifier(p.death)}` : '';
  return (
    <button type="button" className={`person-btn${selected ? ' person-btn-selected' : ''}`} aria-pressed={selected} onClick={() => onSelect(id)}>
      <span className="person-btn-name">{displayName(p, t('person.née')) || t('person.unnamed')}</span>
      <span className="person-btn-years tnum">{[birthYear, deathYear].filter(Boolean).join(' – ')}</span>
    </button>
  );
}
