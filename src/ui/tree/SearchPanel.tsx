import { useEffect, useMemo, useRef, useState } from 'react';
import { intlTag, useT } from '@/i18n';
import type { Project } from '@/model/types';
import { displayName } from '@/model/types';
import { emptyCriteria, isEmptyCriteria, searchAll } from '@/model/search';
import type { SearchCriteria } from '@/model/search';

/** Search across all fields plus the completeness filters; results jump to a person or restrict the canvas. */
export function SearchPanel({ project, onJump, onShowOnly, onClose }: { project: Project; onJump: (id: string) => void; onShowOnly: (ids: string[]) => void; onClose: () => void }) {
  const { t, locale } = useT();
  const [c, setC] = useState<SearchCriteria>(emptyCriteria);
  const first = useRef<HTMLInputElement>(null);
  useEffect(() => {
    first.current?.focus();
  }, []);
  const set = <K extends keyof SearchCriteria>(k: K, v: SearchCriteria[K]) => setC((prev) => ({ ...prev, [k]: v }));
  const results = useMemo(() => (isEmptyCriteria(c) ? null : searchAll(project, c, intlTag[locale])), [project, c, locale]);
  const name = (id: string) => displayName(project.persons[id]!, t('person.née')) || t('person.unnamed');
  return (
    <section className="filter-bar layout-panel panel search-panel" aria-label={t('search.title')}>
      <div className="stack-tight search-grid">
        <div className="field">
          <label htmlFor="search-text">{t('search.text')}</label>
          <input ref={first} id="search-text" className="input" type="search" value={c.text} onChange={(e) => set('text', e.target.value)} autoComplete="off" />
        </div>
        <fieldset className="search-filters">
          <legend>{t('search.filters')}</legend>
          <label className="check">
            <input type="checkbox" checked={c.missingBirth} onChange={(e) => set('missingBirth', e.target.checked)} /> {t('search.missingBirth')}
          </label>
          <label className="check">
            <input type="checkbox" checked={c.missingDeath} onChange={(e) => set('missingDeath', e.target.checked)} /> {t('search.missingDeath')}
          </label>
          <label className="check">
            <input type="checkbox" checked={c.missingParents} onChange={(e) => set('missingParents', e.target.checked)} /> {t('search.missingParents')}
          </label>
          <div className="field-row">
            <div className="field">
              <label htmlFor="search-from">{t('search.bornFrom')}</label>
              <input id="search-from" className="input input-year" inputMode="numeric" value={c.bornFrom} onChange={(e) => set('bornFrom', e.target.value)} autoComplete="off" />
            </div>
            <div className="field">
              <label htmlFor="search-to">{t('search.bornTo')}</label>
              <input id="search-to" className="input input-year" inputMode="numeric" value={c.bornTo} onChange={(e) => set('bornTo', e.target.value)} autoComplete="off" />
            </div>
          </div>
          <div className="field">
            <label htmlFor="search-place">{t('search.place')}</label>
            <input id="search-place" className="input" value={c.place} onChange={(e) => set('place', e.target.value)} autoComplete="off" />
          </div>
        </fieldset>
        <div className="btn-row">
          {results && results.length > 0 && (
            <button type="button" className="btn btn-primary" onClick={() => onShowOnly(results)}>
              {t('search.showOnly')}
            </button>
          )}
          <button type="button" className="btn" onClick={() => setC(emptyCriteria())}>
            {t('search.clear')}
          </button>
          <button type="button" className="btn btn-quiet" onClick={onClose}>
            {t('search.close')}
          </button>
        </div>
        <p className="hint">{t('search.hint')}</p>
        {results && (
          <div className="stack-tight" role="status">
            <p className="tnum">{results.length === 0 ? t('search.noResults') : t('search.results', { count: results.length })}</p>
            {results.length > 0 && (
              <ul className="people-list search-results-list">
                {results.slice(0, 50).map((id) => (
                  <li key={id}>
                    <button type="button" className="link-btn" onClick={() => onJump(id)}>
                      {name(id)}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
