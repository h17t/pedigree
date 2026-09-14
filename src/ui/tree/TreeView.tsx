import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { TKey } from '@/i18n';
import { useT, formatNumber } from '@/i18n';
import type { Position } from '@/model/types';
import { displayName, personName } from '@/model/types';
import { useAppStore, updateUi, transact } from '@/store/store';
import { addPerson } from '@/model/edits';
import { Canvas } from '@/render/Canvas';
import { CanvasErrorBoundary } from '@/render/CanvasErrorBoundary';
import { layoutAll, layoutSubset, placeUnpositioned, scalingOf } from '@/render/layout';
import { personScales } from '@/render/layout/scale';
import { buildChart, ANCESTOR_GENERATIONS, DESCENDANT_DEPTH } from '@/render/charts';
import type { GenerationScaling } from '@/model/types';
import { clusterFrames } from '@/render/layout/clusters';
import type { ClusterFrame } from '@/render/layout/clusters';
import { announce } from '../status';
import { visiblePersons } from '@/render/filter';
import { cardBox, cardText } from '@/render/geometry';
import type { DetailLevel } from '@/render/geometry';
import { boundsOf } from '@/render/connectors';
import { centerOn, fitTo, zoomAt } from '@/render/viewport';
import type { Viewport } from '@/render/viewport';
import { card } from '@/design/tokens';
import { searchPersons } from '../list/outline';
import { Legend } from './Legend';
import { useIsDesktop } from '../hooks';
import { useRouter } from '../router';
import { DetailsHost } from '../edit/DetailsHost';
import { AddMenu } from '../edit/AddMenu';
import { closeEditor, openEditor, useEditor } from '../edit/editorStore';
import { openPrint } from '../print/printStore';
import { Hint } from '../onboarding/Hint';
import { SearchPanel } from './SearchPanel';
import { useHints } from '@/onboarding/hints';
import { startGuidedHere } from '../onboarding/start';

/**
 * Tree mode: toolbar (search, legend, fit, zoom, card detail, add person), the canvas, the
 * focus filter bar, multi-selection bar, and the selection bar on phones / details column on
 * laptops. Editing opens in the same column or sheet.
 */
function range(a: number, b: number): number[] {
  return Array.from({ length: b - a + 1 }, (_, i) => a + i);
}

export function TreeView() {
  const { t, locale } = useT();
  const project = useAppStore((s) => s.project);
  const ui = useAppStore((s) => s.ui);
  const lockState = useAppStore((s) => s.lockState);
  const warnings = useAppStore((s) => s.warnings);
  const editor = useEditor((s) => s.state);
  const go = useRouter((s) => s.go);
  const isDesktop = useIsDesktop();
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [query, setQuery] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [menu, setMenu] = useState<'none' | 'add' | 'more'>('none');
  const [multi, setMulti] = useState<Set<string>>(() => new Set());
  const searchRef = useRef<HTMLInputElement>(null);
  const level: DetailLevel = ui.detailLevel;
  const readOnly = lockState !== 'owner';
  const editing = editor.kind === 'person' || editor.kind === 'union';

  const placement = useMemo(() => (project ? placeUnpositioned(project, level) : null), [project, level]);
  const scaling: GenerationScaling = project ? scalingOf(project) : 'off';
  const scales = useMemo(() => (project ? personScales(project, scaling) : new Map<string, number>()), [project, scaling]);
  const frames = useMemo(() => (project && placement ? clusterFrames(project, placement.positions, level, scales) : []), [project, placement, level, scales]);
  const [layoutOpen, setLayoutOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const chartSpec = ui.chart && project && project.persons[ui.chart.personId] ? ui.chart : null;
  const chart = useMemo(() => (project && chartSpec ? buildChart(project, chartSpec, level) : null), [project, chartSpec, level]);
  const visible = useMemo(() => (chart ? chart.visible : project ? visiblePersons(project, ui.filter) : new Set<string>()), [project, ui.filter, chart]);
  /** What the canvas shows: chart positions in chart mode, stored/provisional positions otherwise. */
  const positionsNow = useMemo(() => (chart ? chart.positions : placement?.positions ?? new Map<string, Position>()), [chart, placement]);
  const provisionalNow = useMemo(() => (chart ? new Set<string>() : placement?.provisional ?? new Set<string>()), [chart, placement]);
  const framesNow = useMemo(() => (chart ? [] : frames), [chart, frames]);
  const scalesNow = useMemo(() => (chart ? new Map<string, number>() : scales), [chart, scales]);
  const warningIds = useMemo(() => new Set(warnings.map((w) => w.personIds[0]!)), [warnings]);
  const boundsAll = useMemo(() => {
    if (!placement) return null;
    const boxes = [...positionsNow.entries()].filter(([id]) => visible.has(id)).map(([id, p]) => cardBox(p.x, p.y, level, false, scalesNow.get(id) ?? 1));
    return boundsOf(boxes);
  }, [placement, positionsNow, visible, level, scalesNow]);

  const storedViewport = ui.viewport;
  const viewport: Viewport = useMemo(() => storedViewport ?? { x: 40, y: 40, zoom: 1 }, [storedViewport]);
  const setViewport = useCallback((v: Viewport) => updateUi({ viewport: v }), []);
  const onSize = useCallback((w: number, h: number) => setSize({ w, h }), []);

  useEffect(() => {
    if (ui.viewport === null && size.w > 0 && boundsAll) setViewport(fitTo(boundsAll, size.w, size.h));
  }, [ui.viewport, size, boundsAll, setViewport]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setSearchOpen(true);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
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

  // Ignore multi-selection entries that no longer exist (deleted meanwhile).
  const multiLive = useMemo(() => new Set([...multi].filter((id) => project?.persons[id])), [multi, project]);

  const cardLabel = useCallback(
    (id: string) => {
      const p = project?.persons[id];
      if (!p) return '';
      const years = cardText(p, 'minimal', locale).lines[0] || t('dates.unknownDate');
      return t('tree.cardLabel', { name: displayName(p, t('person.née')) || t('person.unnamed'), years });
    },
    [project, locale, t],
  );
  const labels = useMemo(
    () => ({ née: t('person.née'), living: t('person.lifeStatusValue.living'), unknownDate: t('dates.unknownDate'), warning: t('tree.warningMarker'), unknownParents: t('union.partnersUnknown'), canvas: t('tree.canvasLabel') }),
    [t],
  );

  const select = useCallback((id: string | null) => {
    updateUi({ selectedPersonId: id });
    setMulti(new Set());
    setMenu('none');
  }, []);
  const onMultiSelect = useCallback((ids: string[], mode: 'toggle' | 'set') => {
    setMulti((prev) => {
      const next = mode === 'set' ? new Set(ids) : new Set(prev);
      if (mode === 'toggle') {
        const current = useAppStore.getState().ui.selectedPersonId;
        if (current && !next.has(current)) next.add(current);
        for (const id of ids) {
          if (next.has(id)) next.delete(id);
          else next.add(id);
        }
      }
      if (next.size === 1) updateUi({ selectedPersonId: [...next][0]! });
      return next;
    });
  }, []);
  const onDeleteKey = useCallback(() => {
    const ids = multiLive.size > 1 ? [...multiLive] : ui.selectedPersonId ? [ui.selectedPersonId] : [];
    if (ids.length === 0) return;
    if (ids.length === 1) openEditor({ kind: 'deletePerson', id: ids[0]! });
    else openEditor({ kind: 'deleteMany', ids });
  }, [multiLive, ui.selectedPersonId]);

  const openDetails = useCallback(
    (id: string) => {
      updateUi({ selectedPersonId: id });
      if (isDesktop) openEditor({ kind: 'person', id, isNew: false });
      else setSheetOpen(true);
    },
    [isDesktop],
  );
  const frameLabel = useCallback((f: ClusterFrame) => t('layout.frameLabel', { index: f.index, people: t('common.people', { count: f.personIds.length }) }), [t]);

  const total = project ? Object.keys(project.persons).length : 0;
  const offerHint = useHints((h) => h.offer);
  const unplaced = placement ? placement.provisional.size : 0;
  // Contextual tips, offered once their situation arises; the hint store shows one at a time
  // and remembers dismissals.
  useEffect(() => {
    if (total === 0) return;
    if (!ui.selectedPersonId) offerHint('selectCard');
    if (total >= 4 && unplaced > 0) offerHint('arrangeTree');
    if (ui.changesSinceBackup >= 10 && ui.lastBackupAt === null) offerHint('backupSoon');
    if (!isDesktop && total >= 15) offerHint('listView');
  }, [total, ui.selectedPersonId, ui.changesSinceBackup, ui.lastBackupAt, isDesktop, unplaced, offerHint]);

  if (!project || !placement) return null;
  const selected = ui.selectedPersonId ? project.persons[ui.selectedPersonId] : undefined;
  const hidden = total - visible.size;

  const jumpTo = (id: string) => {
    const p = positionsNow.get(id);
    if (!p) return;
    updateUi({ selectedPersonId: id, filter: visible.has(id) ? ui.filter : null, chart: chart && !visible.has(id) ? null : ui.chart });
    setMenu('none');
    const box = cardBox(p.x, p.y, level, false, scalesNow.get(id) ?? 1);
    setViewport(centerOn({ ...viewport, zoom: Math.max(viewport.zoom, 0.8) }, box.x + box.w / 2, box.y + box.h / 2, size.w, size.h));
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
  const moveMany = (moves: { id: string; pos: Position }[]) => {
    transact(t('edit.moveSelected', { count: moves.length }), (d) => {
      for (const m of moves) {
        const p = d.persons[m.id];
        if (p) p.position = m.pos;
      }
    });
  };
  const setBalance = (mode: GenerationScaling) => {
    // Card sizes change, so the tree is arranged again in the same undo step.
    const next = layoutAll(project, level, mode);
    transact(t('layout.balance'), (d) => {
      d.settings.generationScaling = mode;
      for (const [id, pos] of next) {
        const p = d.persons[id];
        if (p) p.position = pos;
      }
    });
    announce(t('layout.balanceDone', { mode: t(`layout.balanceValue.${mode}` as TKey) }));
    updateUi({ viewport: null });
  };
  const arrangeAll = () => {
    const next = layoutAll(project, level);
    transact(t('layout.auto'), (d) => {
      for (const [id, pos] of next) {
        const p = d.persons[id];
        if (p) p.position = pos;
      }
    });
    announce(t('layout.autoDone'));
    updateUi({ viewport: null });
    setLayoutOpen(false);
  };
  const arrangeSelection = () => {
    const ids = [...multiLive];
    const next = layoutSubset(project, ids, placement.positions, level);
    transact(t('layout.selection'), (d) => {
      for (const [id, pos] of next) {
        const p = d.persons[id];
        if (p) p.position = pos;
      }
    });
    announce(t('layout.selectionDone'));
    setLayoutOpen(false);
  };
  const showFamily = (f: ClusterFrame) => {
    setViewport(fitTo(f.box, size.w, size.h));
    setLayoutOpen(false);
  };
  const addNewPerson = () => {
    let id = '';
    transact(t('edit.addedPerson', { what: t('edit.what.person') }), (d) => {
      id = addPerson(d, { position: { x: (size.w / 2 - viewport.x) / viewport.zoom - card.width / 2, y: (size.h / 2 - viewport.y) / viewport.zoom } }).id;
    });
    select(id);
    openEditor({ kind: 'person', id, isNew: true });
  };

  const matches = query.trim() ? searchPersons(project, query).slice(0, 8) : [];
  const nameOf = (id: string) => displayName(project.persons[id] ?? { givenNames: '', surname: '', titlePrefix: '', birthName: '' }, t('person.née'));
  const filterLabel = ui.filter
    ? ui.filter.kind === 'ancestors'
      ? t('tree.filterAncestors', { name: nameOf(ui.filter.personId) })
      : ui.filter.kind === 'descendants'
        ? t('tree.filterDescendants', { name: nameOf(ui.filter.personId) })
        : ui.filter.kind === 'around'
          ? t('tree.filterAround', { count: ui.filter.generations, name: nameOf(ui.filter.personId) })
          : t('tree.filterSearch', { count: ui.filter.ids.length })
    : '';

  const applyFilter = (filter: NonNullable<typeof ui.filter>) => {
    setMenu('none');
    updateUi({ filter, viewport: null });
  };
  const applyChart = (c: NonNullable<typeof ui.chart>) => {
    setMenu('none');
    updateUi({ chart: c, filter: null, viewport: null });
  };
  const chartButtons = selected && (
    <div className="btn-row" role="group" aria-label={t('tree.charts')}>
      <button type="button" className="btn" onClick={() => applyChart({ kind: 'ancestors', personId: selected.id, generations: ANCESTOR_GENERATIONS.default })}>
        {t('tree.chartAncestors')}
      </button>
      <button type="button" className="btn" onClick={() => applyChart({ kind: 'descendants', personId: selected.id, depth: DESCENDANT_DEPTH.default })}>
        {t('tree.chartDescendants')}
      </button>
    </div>
  );
  const chartLabel = chartSpec ? (chartSpec.kind === 'ancestors' ? t('tree.chartAncestorsOf', { name: nameOf(chartSpec.personId) }) : t('tree.chartDescendantsOf', { name: nameOf(chartSpec.personId) })) : '';
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

  const details = (
    <DetailsHost
      project={project}
      person={selected}
      onSelect={jumpTo}
      extra={
        selected && (
          <>
            <h3>{t('tree.charts')}</h3>
            {chartButtons}
            <h3>{t('tree.filter')}</h3>
            {filterButtons}
          </>
        )
      }
    />
  );

  const sheetVisible = !isDesktop && (sheetOpen || editing) && (selected || editing);

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
        <button type="button" className="btn btn-legend" aria-pressed={ui.legendOpen} onClick={() => updateUi({ legendOpen: !ui.legendOpen })}>
          {t('tree.legend')}
        </button>
        <div className="btn-row tree-zoom" role="group" aria-label={t('tree.zoomLevel', { percent: formatNumber(locale, Math.round(viewport.zoom * 100)) })}>
          <button type="button" className="btn" onClick={fit}>
            {t('tree.fit')}
          </button>
          <button type="button" className="btn" onClick={() => zoomBy(1 / 1.25)} aria-label={t('tree.zoomOut')}>
            {/* i18n-ignore */}−
          </button>
          <button type="button" className="btn zoom-reset" onClick={() => setViewport({ ...viewport, zoom: 1 })} aria-label={t('tree.zoom100')}>
            <span className="tnum">{formatNumber(locale, Math.round(viewport.zoom * 100))} %</span>
          </button>
          <button type="button" className="btn" onClick={() => zoomBy(1.25)} aria-label={t('tree.zoomIn')}>
            {/* i18n-ignore */}+
          </button>
        </div>
        <div className="tree-detail">
          <label className="visually-hidden" htmlFor="detail-level">
            {t('tree.detail')}
          </label>
          <select id="detail-level" className="select select-inline" value={level} onChange={(e) => updateUi({ detailLevel: e.target.value as DetailLevel })}>
            <option value="minimal">{t('tree.detailLevel.minimal')}</option>
            <option value="standard">{t('tree.detailLevel.standard')}</option>
            <option value="full">{t('tree.detailLevel.full')}</option>
          </select>
        </div>
        {!chart && (
          <button type="button" className="btn btn-layout" aria-expanded={layoutOpen} onClick={() => setLayoutOpen((v) => !v)}>
            {t('layout.panel')}
          </button>
        )}
        <button type="button" className="btn btn-search-more" aria-expanded={searchOpen} onClick={() => setSearchOpen((v) => !v)}>
          {t('search.open')}
        </button>
        <button type="button" className="btn btn-print" onClick={() => openPrint({ selection: multiLive.size > 1 ? [...multiLive] : ui.selectedPersonId ? [ui.selectedPersonId] : [], filtered: ui.filter ? [...visible] : null, clusters: frames.map((f) => ({ index: f.index, personIds: f.personIds })), defaultContent: 'tree', chart: chart ? { positions: [...chart.positions.entries()], visible: [...chart.visible], lines: chart.lines, useUnions: chart.useUnions, label: chartLabel } : null })}>
          {t('print.open')}
        </button>
        {!readOnly && isDesktop && (
          <button type="button" className="btn btn-primary btn-add" onClick={addNewPerson}>
            {t('edit.addPerson')}
          </button>
        )}
      </div>

      {searchOpen && (
        <SearchPanel
          project={project}
          onJump={(id) => jumpTo(id)}
          onShowOnly={(ids) => {
            updateUi({ filter: { kind: 'ids', ids }, viewport: null, chart: null });
            setSearchOpen(false);
          }}
          onClose={() => setSearchOpen(false)}
        />
      )}
      {layoutOpen && (
        <section className="filter-bar layout-panel panel" aria-label={t('layout.panel')}>
          {!readOnly && (
            <div className="stack-tight">
              <div className="btn-row">
                <button type="button" className="btn btn-primary" onClick={arrangeAll}>
                  {t('layout.auto')}
                </button>
                {multiLive.size > 1 && (
                  <button type="button" className="btn" onClick={arrangeSelection}>
                    {t('layout.selection')}
                  </button>
                )}
                <button type="button" className="btn" aria-pressed={ui.snapToGrid} onClick={() => updateUi({ snapToGrid: !ui.snapToGrid })}>
                  {ui.snapToGrid ? t('layout.snapOn') : t('layout.snapOff')}
                </button>
              </div>
              <p className="hint">{t('layout.autoHint')}</p>
              {placement.provisional.size > 0 && <p className="hint">{t('layout.unplacedHint')}</p>}
              <div className="field">
                <label htmlFor="balance-select">{t('layout.balance')}</label>
                <select id="balance-select" className="select select-inline" value={scaling} onChange={(e) => setBalance(e.target.value as GenerationScaling)} aria-describedby="balance-hint">
                  {(['off', 'gentle', 'strong'] as GenerationScaling[]).map((m) => (
                    <option key={m} value={m}>
                      {t(`layout.balanceValue.${m}` as TKey)}
                    </option>
                  ))}
                </select>
                <p className="hint" id="balance-hint">
                  {t('layout.balanceHint')}
                </p>
              </div>
            </div>
          )}
          {frames.length > 1 && (
            <div className="stack-tight">
              <p className="field-label">{t('layout.families')}</p>
              <div className="btn-row">
                <button type="button" className="btn" onClick={() => { fit(); setLayoutOpen(false); }}>
                  {t('layout.fitAll')}
                </button>
                {frames.map((f) => (
                  <button key={f.index} type="button" className="btn" onClick={() => showFamily(f)} aria-label={t('layout.goToFamily', { index: f.index })}>
                    {t('layout.familyLabel', { index: f.index, people: t('common.people', { count: f.personIds.length }) })}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {chart && chartSpec && (
        <div className="filter-bar notice notice-info chart-bar" role="status">
          <span>{t('tree.chartBar', { what: chartLabel })}</span>
          <span className="chart-controls">
            <label htmlFor="chart-gens">{chartSpec.kind === 'ancestors' ? t('tree.chartGenerations') : t('tree.chartDepth')}</label>
            <select
              id="chart-gens"
              className="select select-inline"
              value={chartSpec.kind === 'ancestors' ? chartSpec.generations : chartSpec.depth}
              onChange={(e) => {
                const n = Number(e.target.value);
                updateUi({ chart: chartSpec.kind === 'ancestors' ? { ...chartSpec, generations: n } : { ...chartSpec, depth: n }, viewport: null });
              }}
            >
              {(chartSpec.kind === 'ancestors' ? range(ANCESTOR_GENERATIONS.min, ANCESTOR_GENERATIONS.max) : range(DESCENDANT_DEPTH.min, DESCENDANT_DEPTH.max)).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </span>
          <button type="button" className="btn" onClick={() => updateUi({ chart: null, viewport: null })}>
            {t('tree.chartClose')}
          </button>
        </div>
      )}
      {ui.filter && !chart && (
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
      {multiLive.size > 1 && (
        <div className="filter-bar multi-bar" role="status">
          <span>{t('edit.selectedCount', { count: multiLive.size })}</span>
          <span className="hint">{t('edit.multiSelectHint')}</span>
          {!readOnly && (
            <button type="button" className="btn btn-danger" onClick={() => openEditor({ kind: 'deleteMany', ids: [...multiLive] })}>
              {t('edit.deleteSelected', { count: multiLive.size })}
            </button>
          )}
          <button type="button" className="btn" onClick={() => setMulti(new Set())}>
            {t('edit.clearSelection')}
          </button>
        </div>
      )}

      <div className="tree-canvas-wrap">
        {total > 0 && (
          <div className="tree-hints">
            <Hint id="addGrandparents" />
            <Hint id="selectCard" />
            <Hint id="arrangeTree" />
            <Hint id="backupSoon" />
            <Hint id="listView" />
          </div>
        )}
        {total === 0 ? (
          <div className="tree-empty">
            <p>{t('tree.empty')}</p>
            <div className="btn-row">
              {!readOnly && (
                <button type="button" className="btn btn-primary" onClick={() => startGuidedHere(project.id)}>
                  {t('tree.startGuided')}
                </button>
              )}
              {!readOnly && (
                <button type="button" className="btn" onClick={addNewPerson}>
                  {t('edit.addPerson')}
                </button>
              )}
              <button type="button" className="btn" onClick={() => go('list')}>
                {t('nav.list')}
              </button>
            </div>
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
              positions={positionsNow}
              visible={visible}
              level={level}
              locale={locale}
              viewport={viewport}
              selectedId={ui.selectedPersonId}
              multiSelected={multiLive}
              warningIds={warningIds}
              readOnly={readOnly}
              snapToGrid={ui.snapToGrid}
              provisional={provisionalNow}
              frames={framesNow}
              frameLabel={frameLabel}
              scales={scalesNow}
              chartLines={chart?.lines}
              hideUnions={chart ? !chart.useUnions : false}
              locked={!!chart}
              labels={labels}
              cardLabel={cardLabel}
              onViewport={setViewport}
              onSelect={select}
              onOpen={openDetails}
              onMove={move}
              onMoveMany={moveMany}
              onMultiSelect={onMultiSelect}
              onDeleteKey={onDeleteKey}
              onSize={onSize}
            />
          </CanvasErrorBoundary>
        )}
        {ui.legendOpen && <Legend onClose={() => updateUi({ legendOpen: false })} />}
        {!readOnly && !isDesktop && !selected && total > 0 && (
          <button type="button" className="btn btn-primary btn-add-floating" onClick={addNewPerson}>
            {t('edit.addPerson')}
          </button>
        )}
      </div>

      {!isDesktop && selected && !sheetVisible && (
        <div className="selection-bar" role="region" aria-label={t('tree.selected', { name: personName(selected) })}>
          <div className="selection-bar-text">
            <span className="selection-name">{personName(selected) || t('person.unnamed')}</span>
            <span className="muted small tnum">{cardText(selected, 'minimal', locale).lines[0]}</span>
            <button type="button" className="btn btn-quiet" onClick={() => select(null)}>
              {t('tree.deselect')}
            </button>
          </div>
          <div className="btn-row selection-actions">
            {readOnly ? (
              <button type="button" className="btn btn-primary" onClick={() => setSheetOpen(true)}>
                {t('tree.details')}
              </button>
            ) : (
              <button type="button" className="btn btn-primary" onClick={() => openEditor({ kind: 'person', id: selected.id, isNew: false })}>
                {t('edit.editPerson')}
              </button>
            )}
            {!readOnly && (
              <button type="button" className="btn" aria-expanded={menu === 'add'} onClick={() => setMenu(menu === 'add' ? 'none' : 'add')}>
                {t('edit.addMenu')}
              </button>
            )}
            <button type="button" className="btn" aria-expanded={menu === 'more'} onClick={() => setMenu(menu === 'more' ? 'none' : 'more')}>
              {t('common.moreActions')}
            </button>
          </div>
          {menu === 'add' && (
            <div className="selection-menu">
              <AddMenu person={selected} onAdded={() => setMenu('none')} />
            </div>
          )}
          {menu === 'more' && (
            <div className="selection-menu">
              <div className="btn-row">
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    setMenu('none');
                    setSheetOpen(true);
                  }}
                >
                  {t('tree.details')}
                </button>
                {!readOnly && (
                  <button type="button" className="btn btn-danger" onClick={() => openEditor({ kind: 'deletePerson', id: selected.id })}>
                    {t('common.delete')}
                  </button>
                )}
              </div>
              {chartButtons}
              {filterButtons}
            </div>
          )}
        </div>
      )}

      {sheetVisible && (
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
        <aside className="tree-details" aria-label={t('person.details')}>
          {details}
        </aside>
      )}
    </div>
  );
}
