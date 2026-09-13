import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useT, formatNumber } from '@/i18n';
import type { Position } from '@/model/types';
import { personName } from '@/model/types';
import { useAppStore, updateUi, transact } from '@/store/store';
import { Canvas } from '@/render/Canvas';
import { CanvasErrorBoundary } from '@/render/CanvasErrorBoundary';
import { placeProvisional } from '@/render/layout/provisional';
import { visiblePersons } from '@/render/filter';
import { cardBox, cardText } from '@/render/geometry';
import type { DetailLevel } from '@/render/geometry';
import { boundsOf } from '@/render/connectors';
import { centerOn, fitTo, zoomAt } from '@/render/viewport';
import type { Viewport } from '@/render/viewport';
import { card } from '@/design/tokens';
import { searchPersons } from '../list/outline';
import { PersonDetails } from '../list/PersonDetails';
import { Legend } from './Legend';
import { useIsDesktop } from '../hooks';
import { useRouter } from '../router';

/**
 * Tree mode: toolbar (fit, zoom, card detail, legend), search that jumps to a person, the
 * canvas, the focus filter bar, and the selection bar on phones / the details column on laptops.
 */
export function TreeView() {
  const { t, locale } = useT();
  const project = useAppStore((s) => s.project);
  const ui = useAppStore((s) => s.ui);
  const lockState = useAppStore((s) => s.lockState);
  const warnings = useAppStore((s) => s.warnings);
  const go = useRouter((s) => s.go);
  const isDesktop = useIsDesktop();
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [query, setQuery] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [filterMenu, setFilterMenu] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const level: DetailLevel = ui.detailLevel;
  const readOnly = lockState !== 'owner';

  const placement = useMemo(() => (project ? placeProvisional(project, level) : null), [project, level]);
  const visible = useMemo(() => (project ? visiblePersons(project, ui.filter) : new Set<string>()), [project, ui.filter]);
  const warningIds = useMemo(() => new Set(warnings.map((w) => w.personIds[0]!)), [warnings]);
  const boundsAll = useMemo(() => {
    if (!placement) return null;
    const boxes = [...placement.positions.entries()].filter(([id]) => visible.has(id)).map(([, p]) => cardBox(p.x, p.y, level));
    return boundsOf(boxes);
  }, [placement, visible, level]);

  const storedViewport = ui.viewport;
  const viewport: Viewport = useMemo(() => storedViewport ?? { x: 40, y: 40, zoom: 1 }, [storedViewport]);
  const setViewport = useCallback((v: Viewport) => updateUi({ viewport: v }), []);
  const onSize = useCallback((w: number, h: number) => setSize({ w, h }), []);

  // First time on this project: fit everything once the canvas has a size.
  useEffect(() => {
    if (ui.viewport === null && size.w > 0 && boundsAll) setViewport(fitTo(boundsAll, size.w, size.h));
  }, [ui.viewport, size, boundsAll, setViewport]);

  // Ctrl+F focuses the search, Ctrl+0 resets zoom.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        searchRef.current?.focus();
      } else if ((e.ctrlKey || e.metaKey) && e.key === '0') {
        e.preventDefault();
        setViewport({ ...viewport, zoom: 1 });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [viewport, setViewport]);

  const cardLabel = useCallback(
    (id: string) => {
      const p = project?.persons[id];
      if (!p) return '';
      const years = cardText(p, 'minimal', locale).lines[0] || t('dates.unknownDate');
      return t('tree.cardLabel', { name: personName(p) || t('person.unnamed'), years });
    },
    [project, locale, t],
  );
  const labels = useMemo(
    () => ({ née: t('person.née'), living: t('person.lifeStatusValue.living'), unknownDate: t('dates.unknownDate'), warning: t('tree.warningMarker'), unknownParents: t('union.partnersUnknown'), canvas: t('tree.canvasLabel') }),
    [t],
  );

  if (!project || !placement) return null;
  const total = Object.keys(project.persons).length;
  const selected = ui.selectedPersonId ? project.persons[ui.selectedPersonId] : undefined;
  const hidden = total - visible.size;

  const select = (id: string | null) => {
    updateUi({ selectedPersonId: id });
    setFilterMenu(false);
  };
  const openDetails = (id: string) => {
    updateUi({ selectedPersonId: id });
    if (isDesktop) return;
    setSheetOpen(true);
  };
  const jumpTo = (id: string) => {
    const p = placement.positions.get(id);
    if (!p) return;
    updateUi({ selectedPersonId: id, filter: visible.has(id) ? ui.filter : null });
    setViewport(centerOn({ ...viewport, zoom: Math.max(viewport.zoom, 0.8) }, p.x + card.width / 2, p.y + cardBox(0, 0, level).h / 2, size.w, size.h));
    setQuery('');
  };
  const fit = () => setViewport(fitTo(boundsAll, size.w, size.h));
  const zoomBy = (f: number) => setViewport(zoomAt(viewport, f, size.w / 2, size.h / 2));
  const move = (id: string, pos: Position) => {
    const name = personName(project.persons[id]!);
    transact(t('tree.moved', { name }), (d) => {
      const p = d.persons[id];
      if (p) p.position = pos;
    });
  };

  const matches = query.trim() ? searchPersons(project, query).slice(0, 8) : [];
  const filterLabel = ui.filter
    ? ui.filter.kind === 'ancestors'
      ? t('tree.filterAncestors', { name: personName(project.persons[ui.filter.personId] ?? { givenNames: '', surname: '', titlePrefix: '' }) })
      : ui.filter.kind === 'descendants'
        ? t('tree.filterDescendants', { name: personName(project.persons[ui.filter.personId] ?? { givenNames: '', surname: '', titlePrefix: '' }) })
        : t('tree.filterAround', { count: ui.filter.generations, name: personName(project.persons[ui.filter.personId] ?? { givenNames: '', surname: '', titlePrefix: '' }) })
    : '';

  const applyFilter = (filter: NonNullable<typeof ui.filter>) => {
    setFilterMenu(false);
    updateUi({ filter, viewport: null });
  };
  const filterButtons = selected && (
    <div className="btn-row" role="group" aria-label={t('tree.filter')}>
      <button type="button" className="btn" onClick={() => applyFilter({ kind: 'ancestors', personId: selected.id })}>
        {t('tree.filterAncestors', { name: personName(selected) })}
      </button>
      <button type="button" className="btn" onClick={() => applyFilter({ kind: 'descendants', personId: selected.id })}>
        {t('tree.filterDescendants', { name: personName(selected) })}
      </button>
      <button type="button" className="btn" onClick={() => applyFilter({ kind: 'around', personId: selected.id, generations: 2 })}>
        {t('tree.filterAroundLabel', { name: personName(selected) })}
      </button>
    </div>
  );

  const details = selected ? (
    <div className="stack">
      <PersonDetails project={project} person={selected} onSelect={jumpTo} />
      {filterButtons}
    </div>
  ) : (
    <p className="muted">{t('tree.noSelection')}</p>
  );

  return (
    <div className={`tree-view${isDesktop ? ' tree-view-desktop' : ''}`}>
      <div className="tree-toolbar">
        <div className="tree-search">
          <label htmlFor="tree-search" className="visually-hidden">
            {t('tree.searchJump')}
          </label>
          <input ref={searchRef} id="tree-search" className="input" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('list.searchPlaceholder')} autoComplete="off" aria-controls={query.trim() ? 'tree-search-results' : undefined} />
          {query.trim() && (
            <ul id="tree-search-results" className="search-results panel" aria-label={t('common.search')}>
              {matches.length === 0 ? (
                <li className="muted search-empty">{t('list.noMatches', { query: query.trim() })}</li>
              ) : (
                matches.map((id) => (
                  <li key={id}>
                    <button type="button" className="search-result" onClick={() => jumpTo(id)}>
                      {cardLabel(id)}
                    </button>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>
        <div className="btn-row tree-zoom" role="group" aria-label={t('tree.zoomLevel', { percent: formatNumber(locale, Math.round(viewport.zoom * 100)) })}>
          <button type="button" className="btn" onClick={fit}>
            {t('tree.fit')}
          </button>
          <button type="button" className="btn" onClick={() => zoomBy(1 / 1.25)} aria-label={t('tree.zoomOut')}>
            {/* i18n-ignore */}−
          </button>
          <button type="button" className="btn" onClick={() => setViewport({ ...viewport, zoom: 1 })} aria-label={t('tree.zoom100')}>
            <span className="tnum">{formatNumber(locale, Math.round(viewport.zoom * 100))} %</span>
          </button>
          <button type="button" className="btn" onClick={() => zoomBy(1.25)} aria-label={t('tree.zoomIn')}>
            {/* i18n-ignore */}+
          </button>
        </div>
        <div className="btn-row tree-options">
          <label className="visually-hidden" htmlFor="detail-level">
            {t('tree.detail')}
          </label>
          <select id="detail-level" className="select select-inline" value={level} onChange={(e) => updateUi({ detailLevel: e.target.value as DetailLevel })}>
            <option value="minimal">{t('tree.detailLevel.minimal')}</option>
            <option value="standard">{t('tree.detailLevel.standard')}</option>
            <option value="full">{t('tree.detailLevel.full')}</option>
          </select>
          <button type="button" className="btn" aria-pressed={ui.legendOpen} onClick={() => updateUi({ legendOpen: !ui.legendOpen })}>
            {t('tree.legend')}
          </button>
        </div>
      </div>

      {ui.filter && (
        <div className="filter-bar notice notice-info" role="status">
          <span>
            {t('tree.showing', { what: filterLabel })}
            {hidden > 0 ? ` · ${t('tree.hiddenCount', { count: hidden })}` : ''}
          </span>
          <button type="button" className="btn" onClick={() => updateUi({ filter: null, viewport: null })}>
            {t('tree.showEveryone')}
          </button>
        </div>
      )}

      <div className="tree-canvas-wrap">
        {total === 0 ? (
          <div className="tree-empty">
            <p>{t('tree.empty')}</p>
            <button type="button" className="btn" onClick={() => go('list')}>
              {t('nav.list')}
            </button>
          </div>
        ) : (
          <CanvasErrorBoundary
            fallback={(reset) => (
              <div className="notice notice-danger tree-empty">
                <p>{t('errors.canvasFailed')}</p>
                <div className="btn-row">
                  <button type="button" className="btn" onClick={reset}>
                    {t('errors.tryAgain')}
                  </button>
                  <button type="button" className="btn" onClick={() => go('data')}>
                    {t('nav.data')}
                  </button>
                </div>
              </div>
            )}
          >
            <Canvas
              project={project}
              positions={placement.positions}
              visible={visible}
              level={level}
              locale={locale}
              viewport={viewport}
              selectedId={ui.selectedPersonId}
              warningIds={warningIds}
              readOnly={readOnly}
              snapToGrid={false}
              labels={labels}
              cardLabel={cardLabel}
              onViewport={setViewport}
              onSelect={select}
              onOpen={openDetails}
              onMove={move}
              onSize={onSize}
            />
          </CanvasErrorBoundary>
        )}
        {ui.legendOpen && <Legend onClose={() => updateUi({ legendOpen: false })} />}
      </div>

      {!isDesktop && selected && (
        <div className="selection-bar" role="region" aria-label={t('tree.selected', { name: personName(selected) })}>
          <div className="selection-bar-text">
            <span className="selection-name">{personName(selected) || t('person.unnamed')}</span>
            <span className="muted small tnum">{cardText(selected, 'minimal', locale).lines[0]}</span>
          </div>
          <div className="btn-row">
            <button type="button" className="btn btn-primary" onClick={() => setSheetOpen(true)}>
              {t('tree.details')}
            </button>
            <button type="button" className="btn" aria-expanded={filterMenu} onClick={() => setFilterMenu((v) => !v)}>
              {t('tree.filter')}
            </button>
            <button type="button" className="btn btn-quiet" onClick={() => select(null)}>
              {t('tree.deselect')}
            </button>
          </div>
          {filterMenu && <div className="selection-menu">{filterButtons}</div>}
        </div>
      )}

      {!isDesktop && sheetOpen && selected && (
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
        <aside className="tree-details" aria-label={t('person.details')}>
          {details}
        </aside>
      )}
    </div>
  );
}
