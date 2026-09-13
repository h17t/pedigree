import { useEffect, useMemo, useState } from 'react';
import { useT } from '@/i18n';
import type { DateQualifier, Person, Project } from '@/model/types';
import { personName } from '@/model/types';
import { formatDateWithQualifier } from '@/model/dates';
import { useAppStore, updateUi } from '@/store/store';
import { buildOutline, searchPersons } from './outline';
import type { PersonRow, UnionRow } from './outline';
import { PersonDetails } from './PersonDetails';
import { useIsDesktop } from '../hooks';

/**
 * The list/outline mode: an indented, collapsible outline of every family, a search field,
 * and the details of the selected person (right column on laptops, full-height sheet on
 * phones). This is the keyboard- and screen-reader-friendly twin of the canvas.
 */
export function ListView() {
  const { t } = useT();
  const project = useAppStore((s) => s.project);
  const selectedId = useAppStore((s) => s.ui.selectedPersonId);
  const expandedList = useAppStore((s) => s.ui.expanded);
  const [query, setQuery] = useState('');
  const isDesktop = useIsDesktop();
  const [sheetOpen, setSheetOpen] = useState(false);

  const outline = useMemo(() => (project ? buildOutline(project) : null), [project]);
  const expanded = useMemo(() => new Set(expandedList), [expandedList]);

  // First visit of a project: open the first two levels.
  useEffect(() => {
    if (!outline || !project) return;
    if (expandedList.length === 0 && outline.expandableIds.length > 0) {
      const firstLevels = new Set<string>();
      const walk = (rows: PersonRow[]) => {
        for (const r of rows) {
          if (r.depth <= 2) firstLevels.add(r.personId);
          for (const u of r.unions) walk(u.children);
        }
      };
      for (const s of outline.sections) {
        walk(s.roots);
        for (const g of s.orphanGroups) walk(g.children);
      }
      updateUi({ expanded: [...firstLevels, '__initialized__'] });
    }
  }, [outline, project, expandedList.length]);

  if (!project || !outline) return null;
  const selected = selectedId ? project.persons[selectedId] : undefined;

  const select = (id: string) => {
    updateUi({ selectedPersonId: id });
    if (!isDesktop) setSheetOpen(true);
  };
  const toggle = (id: string) => {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    updateUi({ expanded: [...next] });
  };
  const setAll = (open: boolean) => updateUi({ expanded: open ? [...outline.expandableIds, '__initialized__'] : ['__initialized__'] });

  const matches = query.trim() ? searchPersons(project, query) : null;
  const total = Object.keys(project.persons).length;

  const details = selected ? <PersonDetails project={project} person={selected} onSelect={select} /> : <p className="muted">{t('list.selectHint')}</p>;

  return (
    <div className="list-view">
      <div className="list-head">
        <h2>{t('list.title')}</h2>
        <p className="muted">{t('list.intro')}</p>
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
        <ul className="outline outline-flat" aria-label={t('common.search')}>
          {matches.map((id) => (
            <li key={id}>
              <PersonButton project={project} id={id} selected={id === selectedId} onSelect={select} />
            </li>
          ))}
        </ul>
      ) : (
        <>
          <div className="btn-row">
            <button type="button" className="btn" onClick={() => setAll(true)}>
              {t('list.expandAll')}
            </button>
            <button type="button" className="btn" onClick={() => setAll(false)}>
              {t('list.collapseAll')}
            </button>
          </div>
          <div className="outline-sections">
            {outline.sections.map((s) => (
              <section key={s.index} className="outline-section" aria-labelledby={`section-${s.index}`}>
                <h3 id={`section-${s.index}`} className="outline-section-title">
                  {s.isolated ? t('list.isolated') : t('list.clusterOf', { index: s.index, total: outline.sections.length, people: t('common.people', { count: s.personIds.length }) })}
                </h3>
                <ul className="outline" aria-label={t('list.outline')}>
                  {s.orphanGroups.map((g) => (
                    <UnionItem key={g.key} row={g} project={project} expanded={expanded} selectedId={selectedId} onSelect={select} onToggle={toggle} />
                  ))}
                  {s.roots.map((r) => (
                    <PersonItem key={r.key} row={r} project={project} expanded={expanded} selectedId={selectedId} onSelect={select} onToggle={toggle} />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}

      {!isDesktop &&
        sheetOpen &&
        selected && (
          <div className="sheet" role="dialog" aria-modal="true" aria-label={t('person.details')}>
            <div className="sheet-head">
              <button type="button" className="btn btn-quiet" onClick={() => setSheetOpen(false)}>
                {t('common.back')}
              </button>
              <span className="sheet-title">{t('person.details')}</span>
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
  const birthYear = p.birth.date ? formatYear(p.birth.date, p.birth.qualifier) : '';
  const deathYear = p.death.date ? `† ${formatYear(p.death.date, p.death.qualifier)}` : '';
  return (
    <button type="button" className={`person-btn${selected ? ' person-btn-selected' : ''}`} aria-pressed={selected} onClick={() => onSelect(id)}>
      <span className="person-btn-name">{personName(p) || t('person.unnamed')}</span>
      <span className="person-btn-years tnum">{[birthYear, deathYear].filter(Boolean).join(' – ')}</span>
    </button>
  );
}

function formatYear(date: string, q: DateQualifier): string {
  const mark = q === 'about' || q === 'estimated' ? '~' : q === 'before' ? '<' : q === 'after' ? '>' : '';
  return `${mark}${date.slice(0, 4)}`;
}

function PersonItem({ row, project, expanded, selectedId, onSelect, onToggle }: { row: PersonRow; project: Project; expanded: Set<string>; selectedId: string | null; onSelect: (id: string) => void; onToggle: (id: string) => void }) {
  const { t } = useT();
  const hasChildren = row.unions.some((u) => u.children.length > 0);
  const isOpen = expanded.has(row.personId);
  const parentKeyPerson = row.alsoUnder ? row.alsoUnder.split('/u/')[0]?.split('/').pop() ?? null : null;
  return (
    <li className="outline-item">
      <div className="outline-row">
        {hasChildren ? (
          <button type="button" className="toggle-btn" aria-expanded={isOpen} aria-label={isOpen ? t('list.hideChildren') : t('list.showChildren')} onClick={() => onToggle(row.personId)}>
            <span aria-hidden="true">{isOpen ? '−' : '+'}</span>
          </button>
        ) : (
          <span className="toggle-spacer" aria-hidden="true" />
        )}
        <PersonButton project={project} id={row.personId} selected={row.personId === selectedId} onSelect={onSelect} />
        {row.alsoUnder && parentKeyPerson && project.persons[parentKeyPerson] && <span className="person-note muted small">{t('list.alsoListed', { name: personName(project.persons[parentKeyPerson]) })}</span>}
      </div>
      {row.unions.length > 0 && (
        <ul className="outline outline-nested" hidden={hasChildren && !isOpen}>
          {row.unions.map((u) => (
            <UnionItem key={u.key} row={u} project={project} expanded={expanded} selectedId={selectedId} onSelect={onSelect} onToggle={onToggle} />
          ))}
        </ul>
      )}
    </li>
  );
}

function UnionItem({ row, project, expanded, selectedId, onSelect, onToggle }: { row: UnionRow; project: Project; expanded: Set<string>; selectedId: string | null; onSelect: (id: string) => void; onToggle: (id: string) => void }) {
  const { t, locale } = useT();
  const u = project.unions[row.unionId];
  if (!u) return null;
  const partnerNames = row.partnerIds.map((id) => project.persons[id]).filter((p): p is Person => p !== undefined);
  const status = u.status !== 'unknown' ? t(`union.status.${u.status}`) : u.type !== 'unknown' ? t(`union.type.${u.type}`) : '';
  const when = u.marriageDate ? formatDateWithQualifier(locale, u.marriageDate, u.marriageQualifier) : '';
  return (
    <li className="outline-union">
      <div className="union-row">
        {u.partnerIds.length === 0 ? (
          <span className="union-label union-unknown">{t('list.parentsUnknown')}</span>
        ) : partnerNames.length === 0 ? (
          <span className="union-label muted">{t('list.withPartner', { name: t('common.unknown') })}</span>
        ) : (
          <span className="union-label">
            {t('list.withPartner', { name: '' }).trim()}{' '}
            {partnerNames.map((p) => (
              <button key={p.id} type="button" className="link-btn" onClick={() => onSelect(p.id)}>
                {personName(p) || t('person.unnamed')}
              </button>
            ))}
          </span>
        )}
        {(status || when) && <span className="muted small tnum">{[status, when].filter(Boolean).join(' · ')}</span>}
      </div>
      {row.children.length > 0 && (
        <ul className="outline outline-nested">
          {row.children.map((c) => (
            <PersonItem key={c.key} row={c} project={project} expanded={expanded} selectedId={selectedId} onSelect={onSelect} onToggle={onToggle} />
          ))}
        </ul>
      )}
    </li>
  );
}
