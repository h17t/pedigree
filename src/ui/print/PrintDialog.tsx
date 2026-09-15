import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useT, formatNumber, formatBytes, intlTag } from '@/i18n';
import type { TKey } from '@/i18n';
import { useAppStore } from '@/store/store';
import { withoutPrivate } from '@/model/privacy';
import { placeUnpositioned } from '@/render/layout';
import type { DetailLevel } from '@/render/geometry';
import { PAPER, sheetFor, mmToPx, LARGE_FORMATS } from '@/print/paper';
import type { PaperSize, Orientation } from '@/print/paper';
import { fitToSheet, smallestTextAt, isLegible, LEGIBILITY_PT, DRAWING_PAD } from '@/print/scale';
import { tile, MAX_SHEETS } from '@/print/tiling';
import { pngSize, PNG_DPIS, svgToPngBlob } from '@/print/png';
import type { PngDpi } from '@/print/png';
import { treeContent, timelineContent, statisticsContent, headerMarkup, legendMarkup, legendHeight, svgDocument, fontsFor, HEADER_H, CARD_FONT_WEIGHTS, LARGE_FONT_BYTES } from '@/print/svgDocument';
import type { LegendLine } from '@/print/svgDocument';
import { BASE_PATH } from '@/basePath';
import { color, card } from '@/design/tokens';
import { usePrint } from './printStore';
import { announce } from '../status';
import { Dialog } from '../components/Dialog';

type Content = 'tree' | 'timeline' | 'statistics';
type Scope = { kind: 'all' } | { kind: 'selection' } | { kind: 'filter' } | { kind: 'cluster'; index: number } | { kind: 'chart' };

/**
 * The in-app print dialog: paper, orientation, margin, fit-or-tile, detail, scope, header,
 * legend, black-and-white; a to-scale preview with margins; print via the browser with a
 * matching @page rule; SVG (fonts embedded) and PNG (capped) export; PDF instructions.
 */
export function PrintDialog() {
  const { t, locale } = useT();
  const open = usePrint((s) => s.open);
  const hide = usePrint((s) => s.hide);
  const ctx = usePrint((s) => s.context);
  const project = useAppStore((s) => s.project);
  const [content, setContent] = useState<Content>(ctx.defaultContent);
  const [scope, setScope] = useState<Scope>(ctx.chart ? { kind: 'chart' } : { kind: 'all' });
  const [paper, setPaper] = useState<PaperSize>('A4');
  const [orientation, setOrientation] = useState<Orientation>('landscape');
  const [margin, setMargin] = useState(10);
  const [mode, setMode] = useState<'fit' | 'tile'>('fit');
  const [tileScale, setTileScale] = useState(100);
  const [overlap, setOverlap] = useState(10);
  const [level, setLevel] = useState<DetailLevel>('standard');
  const [title, setTitle] = useState(project?.name ?? '');
  const [subtitle, setSubtitle] = useState('');
  const [withDate, setWithDate] = useState(true);
  const [withLegend, setWithLegend] = useState(true);
  const [bw, setBw] = useState(false);
  const [hidePrivate, setHidePrivate] = useState(true);
  const [dpi, setDpi] = useState<PngDpi>(300);
  const [previewSheet, setPreviewSheet] = useState(1);
  const [busy, setBusy] = useState(false);
  const [printing, setPrinting] = useState<string[] | null>(null);

  // The dialog is mounted only while open, so the initial state above is fresh every time.

  const labels = useMemo(() => ({ née: t('person.née'), living: t('person.lifeStatusValue.living'), unknownDate: t('dates.unknownDate'), warning: t('tree.warningMarker'), private: t('person.privateMark'), unknownParents: t('union.partnersUnknown') }), [t]);
  const legendLines: LegendLine[] = useMemo(
    () => [
      { kind: 'marriage', text: t('tree.legendItems.marriage') },
      { kind: 'divorced', text: t('tree.legendItems.divorced') },
      { kind: 'plain', text: t('tree.legendItems.partnership') },
      { kind: 'dashed', text: t('tree.legendItems.unknownUnion') },
      { kind: 'biological', text: t('tree.legendItems.biological') },
      { kind: 'adopted', text: t('tree.legendItems.adopted') },
      { kind: 'step', text: t('tree.legendItems.step') },
      { kind: 'text', text: `${t('tree.legendItems.deceased')} · ${t('tree.legendItems.about')} · ${t('tree.legendItems.before')} · ${t('tree.legendItems.after')}` },
      { kind: 'text', text: level === 'full' ? t('print.notesShortened') : t('tree.legendItems.truncated') },
      ...(project?.groups ?? []).map((g): LegendLine => ({ kind: 'swatch', text: g.name || t(`edit.tagColors.${g.color}` as TKey), color: g.color })),
    ],
    [t, level, project],
  );

  // Which people are in scope.
  const visible = useMemo(() => {
    if (!project) return new Set<string>();
    const ids =
      scope.kind === 'chart' && ctx.chart
        ? ctx.chart.visible
        : scope.kind === 'selection' && ctx.selection.length
          ? ctx.selection
          : scope.kind === 'filter' && ctx.filtered
            ? ctx.filtered
            : scope.kind === 'cluster'
              ? (ctx.clusters.find((c) => c.index === scope.index)?.personIds ?? [])
              : Object.keys(project.persons);
    return new Set(hidePrivate ? ids.filter((id) => !project.persons[id]?.isPrivate) : ids);
  }, [project, scope, ctx, hidePrivate]);
  const privateCount = useMemo(() => (project ? Object.values(project.persons).filter((p) => p.isPrivate).length : 0), [project]);
  /** The project as printed: without private people when they are hidden. */
  const printed = useMemo(() => (project && hidePrivate ? withoutPrivate(project) : project), [project, hidePrivate]);

  const drawing = useMemo(() => {
    if (!project || !open) return null;
    if (content === 'timeline') return timelineContent(printed ?? project, locale, { unnamed: t('person.unnamed') });
    if (content === 'statistics') return statisticsContent(printed ?? project, locale, { basis: 'Basis', people: t('stats.people'), unions: t('stats.unions'), generations: t('stats.generations'), ageAtDeath: t('stats.ageAtDeath'), lifeExpectancy: t('stats.lifeExpectancy'), childrenPerUnion: t('stats.childrenPerUnion'), givenNames: t('stats.givenNames'), surnames: t('stats.surnames'), occupations: t('stats.occupations'), places: t('stats.places') });
    const chart = scope.kind === 'chart' ? ctx.chart : null;
    const positions = chart ? new Map(chart.positions) : placeUnpositioned(project, level).positions;
    return treeContent({ project, positions, visible, level, locale, labels, header: null, legend: null, blackAndWhite: bw, lines: chart?.lines, useUnions: chart ? chart.useUnions : true });
  }, [project, printed, open, content, level, visible, locale, labels, bw, t, scope, ctx.chart]);

  const sheet = sheetFor(paper, orientation, margin);
  const headerPx = title || subtitle || withDate ? HEADER_H : 0;
  const areaPx = { w: mmToPx(sheet.areaW), h: mmToPx(sheet.areaH) };
  const legendPx = withLegend && content === 'tree' ? legendHeight(legendLines, areaPx.w) : 0;
  const sheetPx = { w: mmToPx(sheet.width), h: mmToPx(sheet.height) };
  const marginPx = mmToPx(sheet.margin);
  const effectiveMode = content === 'tree' ? mode : 'fit';
  const fit = drawing ? fitToSheet(drawing.bounds, sheet, headerPx + legendPx) : null;
  const tiling = drawing && effectiveMode === 'tile' ? tile(drawing.bounds, sheet, tileScale / 100, overlap, headerPx + legendPx) : null;
  const sheetTotal = tiling ? tiling.tiles.length : 1;
  // "Balance generations" shrinks some cards; the smallest text on paper is in those.
  const cardScale = drawing && 'minScale' in drawing && typeof drawing.minScale === 'number' ? drawing.minScale : 1;
  const smallestPt = (effectiveMode === 'tile' ? smallestTextAt(tileScale / 100) : (fit?.smallestTextPt ?? 0)) * cardScale;
  const dateText = withDate ? new Intl.DateTimeFormat(intlTag[locale], { dateStyle: 'long' }).format(new Date()) : '';

  const overlayFor = (sheetIndex: number, total: number) => {
    const parts: string[] = [];
    if (headerPx) parts.push(`<g transform="translate(${marginPx} ${marginPx})">${headerMarkup({ title, subtitle: total > 1 ? `${subtitle ? subtitle + ' · ' : ''}${t('print.sheetLabel', { index: sheetIndex, count: total })}` : subtitle, date: dateText }, areaPx.w)}</g>`);
    if (legendPx) parts.push(`<g transform="translate(${marginPx} ${marginPx + areaPx.h - legendPx + 8})">${legendMarkup(legendLines, areaPx.w, bw)}</g>`);
    if (total > 1) {
      // crop marks at the printable-area corners
      const m = marginPx, L = 14;
      const corners = [[m, m], [sheetPx.w - m, m], [m, sheetPx.h - m], [sheetPx.w - m, sheetPx.h - m]];
      for (const [x, y] of corners as [number, number][]) parts.push(`<path d="M${x - L} ${y}h${2 * L}M${x} ${y - L}v${2 * L}" stroke="${color.ink}" stroke-width="0.75" fill="none"/>`);
    }
    return parts.join('');
  };

  const buildSheet = (sheetIndex: number, fontCss: string): string => {
    if (!drawing || !fit) return '';
    const vb = tiling ? tiling.tiles[sheetIndex - 1]!.viewBox : fit.viewBox;
    let content2 = drawing.markup;
    if (tiling && sheetIndex === 1) content2 += assemblyMarkup(tiling.drawing, tiling, vb);
    return svgDocument({ widthMm: sheet.width, heightMm: sheet.height, viewBox: vb, content: content2, overlay: overlayFor(sheetIndex, sheetTotal), fontCss, title, areaPx, marginPx, headerPx, legendPx, sheetPx });
  };

  const previewSvg = useMemo(() => (drawing && fit ? buildSheet(Math.min(previewSheet, sheetTotal), '') : ''), [drawing, fit, previewSheet, sheetTotal, title, subtitle, dateText, legendLines, sheet.width, sheet.height, margin, tileScale, overlap, mode, content, bw]); // eslint-disable-line react-hooks/exhaustive-deps

  const fileBase = () => {
    const safe = (project?.name ?? 'tree').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 60) || 'tree';
    return `${t('print.filePrefix')}-${safe}-${new Date().toISOString().slice(0, 10)}`;
  };
  const download = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    announce(t('print.saved', { file: name }));
  };
  const wholeDrawingSvg = async () => {
    if (!drawing) return '';
    const fontCss = (await fontsFor(drawing.text + title + subtitle + dateText + legendLines.map((l) => l.text).join(''), CARD_FONT_WEIGHTS, BASE_PATH)).css;
    // Whole drawing at 100 %: paper size follows the drawing.
    const wPx = drawing.bounds.w + 2 * DRAWING_PAD + 2 * marginPx, hPx = drawing.bounds.h + 2 * DRAWING_PAD + 2 * marginPx + headerPx + legendPx;
    const areaW = wPx - 2 * marginPx, areaH = hPx - 2 * marginPx;
    return svgDocument({
      widthMm: wPx / mmToPx(1), heightMm: hPx / mmToPx(1), viewBox: { x: drawing.bounds.x - DRAWING_PAD, y: drawing.bounds.y - DRAWING_PAD, w: drawing.bounds.w + 2 * DRAWING_PAD, h: drawing.bounds.h + 2 * DRAWING_PAD },
      content: drawing.markup,
      overlay: (headerPx ? `<g transform="translate(${marginPx} ${marginPx})">${headerMarkup({ title, subtitle, date: dateText }, areaW)}</g>` : '') + (legendPx ? `<g transform="translate(${marginPx} ${marginPx + areaH - legendPx + 8})">${legendMarkup(legendLines, areaW, bw)}</g>` : ''),
      fontCss, title, areaPx: { w: areaW, h: areaH }, marginPx, headerPx, legendPx, sheetPx: { w: wPx, h: hPx },
    });
  };
  const onSvg = async () => {
    setBusy(true);
    try {
      const fonts = await fontsFor((drawing?.text ?? '') + title + subtitle + dateText + legendLines.map((l) => l.text).join(''), CARD_FONT_WEIGHTS, BASE_PATH);
      const svg = effectiveMode === 'tile' ? await wholeDrawingSvg() : buildSheet(1, fonts.css);
      download(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), `${fileBase()}.svg`);
      // East Asian fonts can make the file very large; say so and point to PNG.
      if (fonts.bytes > LARGE_FONT_BYTES) announce(t('print.svgLarge', { size: formatBytes(locale, fonts.bytes) }), 'warn');
    } catch {
      announce(t('print.saveFailed'), 'danger');
    } finally {
      setBusy(false);
    }
  };
  const onPdf = async () => {
    if (!drawing) return;
    setBusy(true);
    try {
      // One page per sheet, drawn from the very SVG the SVG export writes; the fonts are
      // embedded by the PDF writer, so the sheets are built without the CSS copies.
      const { exportPdf, CjkNotSupported } = await import('@/print/pdf');
      const sheets = Array.from({ length: sheetTotal }, (_, i) => ({ svg: buildSheet(i + 1, ''), widthMm: sheet.width, heightMm: sheet.height }));
      const text = (drawing.text ?? '') + title + subtitle + dateText + legendLines.map((l) => l.text).join('');
      try {
        const bytes = await exportPdf(
          { sheets, text, weights: CARD_FONT_WEIGHTS, base: BASE_PATH, title: title || (project?.name ?? 'Pedigree'), creator: 'Pedigree' },
          async (file) => (await fetch(`${BASE_PATH}${file}`)).arrayBuffer(),
          (svg) => new DOMParser().parseFromString(svg, 'image/svg+xml'),
        );
        download(new Blob([bytes as BlobPart], { type: 'application/pdf' }), `${fileBase()}.pdf`);
      } catch (e) {
        // East Asian fonts are far too large to embed; the browser's own print route has them.
        if (e instanceof CjkNotSupported) announce(t('print.pdfCjk'), 'warn');
        else throw e;
      }
    } catch {
      announce(t('print.saveFailed'), 'danger');
    } finally {
      setBusy(false);
    }
  };
  const png = pngSize(sheet.width, sheet.height, dpi);
  const onPng = async () => {
    if (!png.allowed) return;
    setBusy(true);
    try {
      const fonts = await fontsFor((drawing?.text ?? '') + title + subtitle + dateText + legendLines.map((l) => l.text).join(''), CARD_FONT_WEIGHTS, BASE_PATH);
      const blob = await svgToPngBlob(buildSheet(Math.min(previewSheet, sheetTotal), fonts.css), png.width, png.height);
      download(blob, `${fileBase()}.png`);
    } catch {
      announce(t('print.saveFailed'), 'danger');
    } finally {
      setBusy(false);
    }
  };
  const onPrint = () => {
    if (!drawing) return;
    const sheets: string[] = [];
    for (let i = 1; i <= sheetTotal; i++) sheets.push(buildSheet(i, ''));
    setPrinting(sheets);
  };
  useEffect(() => {
    if (!printing) return;
    const style = document.createElement('style');
    style.setAttribute('data-print-page', '');
    style.textContent = `@page { size: ${sheet.width}mm ${sheet.height}mm; margin: 0; }`;
    document.head.appendChild(style);
    const after = () => {
      setPrinting(null);
      style.remove();
      window.removeEventListener('afterprint', after);
    };
    window.addEventListener('afterprint', after);
    const id = setTimeout(() => window.print(), 50);
    return () => {
      clearTimeout(id);
      style.remove();
      window.removeEventListener('afterprint', after);
    };
  }, [printing, sheet.width, sheet.height]);

  if (!open || !project) return null;
  const legible = isLegible(smallestPt);
  const tooMany = sheetTotal > MAX_SHEETS;
  const empty = !drawing || (content === 'tree' && visible.size === 0);

  return (
    <>
      <Dialog open title={t('print.title')} onClose={hide} wide>
        <div className="print-dialog">
          <form className="print-options" onSubmit={(e) => e.preventDefault()}>
            <fieldset className="form-section">
              <legend>{t('print.content')}</legend>
              {(['tree', 'timeline', 'statistics'] as const).map((c) => (
                <div className="radio-row" key={c}>
                  <input id={`pr-content-${c}`} type="radio" name="pr-content" checked={content === c} onChange={() => setContent(c)} />
                  <label htmlFor={`pr-content-${c}`}>{t(`print.content${c[0]!.toUpperCase()}${c.slice(1)}` as TKey)}</label>
                </div>
              ))}
            </fieldset>
            {content === 'tree' && (
              <fieldset className="form-section">
                <legend>{t('print.scope')}</legend>
                {ctx.chart && (
                  <div className="radio-row">
                    <input id="pr-scope-chart" type="radio" name="pr-scope" checked={scope.kind === 'chart'} onChange={() => setScope({ kind: 'chart' })} />
                    <label htmlFor="pr-scope-chart">{t('print.scopeChart', { what: ctx.chart.label })}</label>
                  </div>
                )}
                <div className="radio-row">
                  <input id="pr-scope-all" type="radio" name="pr-scope" checked={scope.kind === 'all'} onChange={() => setScope({ kind: 'all' })} />
                  <label htmlFor="pr-scope-all">{t('print.scopeAll')}</label>
                </div>
                {ctx.selection.length > 0 && (
                  <div className="radio-row">
                    <input id="pr-scope-sel" type="radio" name="pr-scope" checked={scope.kind === 'selection'} onChange={() => setScope({ kind: 'selection' })} />
                    <label htmlFor="pr-scope-sel">{t('print.scopeSelection', { count: ctx.selection.length })}</label>
                  </div>
                )}
                {ctx.filtered && (
                  <div className="radio-row">
                    <input id="pr-scope-filter" type="radio" name="pr-scope" checked={scope.kind === 'filter'} onChange={() => setScope({ kind: 'filter' })} />
                    <label htmlFor="pr-scope-filter">{t('print.scopeFilter')}</label>
                  </div>
                )}
                {ctx.clusters.length > 1 &&
                  ctx.clusters.map((c) => (
                    <div className="radio-row" key={c.index}>
                      <input id={`pr-scope-c${c.index}`} type="radio" name="pr-scope" checked={scope.kind === 'cluster' && scope.index === c.index} onChange={() => setScope({ kind: 'cluster', index: c.index })} />
                      <label htmlFor={`pr-scope-c${c.index}`}>{t('print.scopeCluster', { index: c.index, people: t('common.people', { count: c.personIds.length }) })}</label>
                    </div>
                  ))}
              </fieldset>
            )}
            <fieldset className="form-section">
              <legend>{t('print.paper')}</legend>
              <div className="field-row">
                <div className="field">
                  <label htmlFor="pr-paper">{t('print.paper')}</label>
                  <select id="pr-paper" className="select" value={paper} onChange={(e) => setPaper(e.target.value as PaperSize)}>
                    {(Object.keys(PAPER) as PaperSize[]).map((p) => (
                      <option key={p} value={p}>
                        {`${p} (${PAPER[p].w} × ${PAPER[p].h} mm)`}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="pr-orientation">{t('print.orientation')}</label>
                  <select id="pr-orientation" className="select" value={orientation} onChange={(e) => setOrientation(e.target.value as Orientation)}>
                    <option value="portrait">{t('print.portrait')}</option>
                    <option value="landscape">{t('print.landscape')}</option>
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="pr-margin">{t('print.margin')}</label>
                  <input id="pr-margin" className="input" type="number" min={0} max={40} value={margin} onChange={(e) => setMargin(Number(e.target.value) || 0)} />
                </div>
              </div>
              {LARGE_FORMATS.includes(paper) && <p className="notice notice-info">{t('print.largeFormat')}</p>}
            </fieldset>
            {content === 'tree' && (
              <fieldset className="form-section">
                <legend>{t('print.scaleMode')}</legend>
                <div className="radio-row">
                  <input id="pr-fit" type="radio" name="pr-mode" checked={mode === 'fit'} onChange={() => setMode('fit')} aria-describedby="pr-fit-hint" />
                  <span>
                    <label htmlFor="pr-fit" className="radio-title">
                      {t('print.fitOne')}
                    </label>
                    <span className="hint" id="pr-fit-hint">
                      {t('print.fitOneHint')}
                    </span>
                  </span>
                </div>
                <div className="radio-row">
                  <input id="pr-tile" type="radio" name="pr-mode" checked={mode === 'tile'} onChange={() => setMode('tile')} aria-describedby="pr-tile-hint" />
                  <span>
                    <label htmlFor="pr-tile" className="radio-title">
                      {t('print.tile')}
                    </label>
                    <span className="hint" id="pr-tile-hint">
                      {t('print.tileHint')}
                    </span>
                  </span>
                </div>
                {mode === 'tile' && (
                  <div className="field-row">
                    <div className="field">
                      <label htmlFor="pr-scale">{t('print.tileScale')} (%)</label>
                      <input id="pr-scale" className="input" type="number" min={20} max={300} step={10} value={tileScale} onChange={(e) => setTileScale(Math.max(20, Math.min(300, Number(e.target.value) || 100)))} aria-describedby="pr-scale-hint" />
                      <p className="hint" id="pr-scale-hint">
                        {t('print.tileScaleHint', { mm: Math.round(card.width / mmToPx(1)) })}
                      </p>
                    </div>
                    <div className="field">
                      <label htmlFor="pr-overlap">{t('print.overlap')}</label>
                      <input id="pr-overlap" className="input" type="number" min={0} max={30} value={overlap} onChange={(e) => setOverlap(Math.max(0, Math.min(30, Number(e.target.value) || 0)))} />
                    </div>
                  </div>
                )}
                <div className="field">
                  <label htmlFor="pr-detail">{t('print.detail')}</label>
                  <select id="pr-detail" className="select" value={level} onChange={(e) => setLevel(e.target.value as DetailLevel)}>
                    <option value="minimal">{t('print.detailMinimal')}</option>
                    <option value="standard">{t('print.detailStandard')}</option>
                    <option value="full">{t('print.detailFull')}</option>
                  </select>
                </div>
              </fieldset>
            )}
            <fieldset className="form-section">
              <legend>{t('print.titleLabel')}</legend>
              <div className="field">
                <label htmlFor="pr-title">{t('print.titleLabel')}</label>
                <input id="pr-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="pr-subtitle">{t('print.subtitleLabel')}</label>
                <input id="pr-subtitle" className="input" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />
              </div>
              <div className="radio-row">
                <input id="pr-date" type="checkbox" checked={withDate} onChange={(e) => setWithDate(e.target.checked)} />
                <label htmlFor="pr-date">{t('print.includeDate')}</label>
              </div>
              {content === 'tree' && (
                <div className="radio-row">
                  <input id="pr-legend" type="checkbox" checked={withLegend} onChange={(e) => setWithLegend(e.target.checked)} />
                  <label htmlFor="pr-legend">{t('print.includeLegend')}</label>
                </div>
              )}
              {privateCount > 0 && (
                <div className="radio-row">
                  <input id="pr-private" type="checkbox" checked={hidePrivate} onChange={(e) => setHidePrivate(e.target.checked)} aria-describedby="pr-private-hint" />
                  <span>
                    <label htmlFor="pr-private">{t('print.hidePrivate')}</label>
                    <span className="hint" id="pr-private-hint">
                      {t('print.hidePrivateHint')}
                    </span>
                  </span>
                </div>
              )}
              {content === 'tree' && (
                <div className="radio-row">
                  <input id="pr-bw" type="checkbox" checked={bw} onChange={(e) => setBw(e.target.checked)} aria-describedby="pr-bw-hint" />
                  <span>
                    <label htmlFor="pr-bw">{t('print.blackAndWhite')}</label>
                    <span className="hint" id="pr-bw-hint">
                      {t('print.blackAndWhiteHint')}
                    </span>
                  </span>
                </div>
              )}
            </fieldset>
          </form>

          <div className="print-preview">
            <h3>{t('print.preview')}</h3>
            {empty ? (
              <p className="muted">{t('print.nothing')}</p>
            ) : (
              <>
                <p className="hint tnum">
                  {t('print.smallestText', { pt: formatNumber(locale, Math.round(smallestPt * 10) / 10) })} · {t('print.sheets', { count: sheetTotal })}
                </p>
                {!legible && (
                  <div className="notice notice-warn">
                    <p>{t('print.legibilityWarning', { pt: formatNumber(locale, Math.round(smallestPt * 10) / 10) })}</p>
                    <ol>
                      {effectiveMode === 'fit' && <li>{t('print.tryTile')}</li>}
                      <li>{t('print.trySvg')}</li>
                      {orientation === 'portrait' && <li>{t('print.tryLandscape')}</li>}
                      {level !== 'minimal' && <li>{t('print.tryLessDetail')}</li>}
                      {ctx.clusters.length > 1 && <li>{t('print.tryCluster')}</li>}
                    </ol>
                  </div>
                )}
                {tooMany && <p className="notice notice-danger">{t('print.tooManySheets', { max: MAX_SHEETS })}</p>}
                {sheetTotal > 1 && (
                  <div className="btn-row" role="group" aria-label={t('print.previewSheet', { index: previewSheet, count: sheetTotal })}>
                    <button type="button" className="btn" onClick={() => setPreviewSheet((s) => Math.max(1, s - 1))} disabled={previewSheet <= 1}>
                      {/* i18n-ignore */}‹
                    </button>
                    <span className="tnum">{t('print.previewSheet', { index: Math.min(previewSheet, sheetTotal), count: sheetTotal })}</span>
                    <button type="button" className="btn" onClick={() => setPreviewSheet((s) => Math.min(sheetTotal, s + 1))} disabled={previewSheet >= sheetTotal}>
                      {/* i18n-ignore */}›
                    </button>
                  </div>
                )}
                <div className="print-sheet" style={{ aspectRatio: `${sheet.width} / ${sheet.height}` }} dangerouslySetInnerHTML={{ __html: previewSvg }} aria-hidden="true" />
                <p className="hint">{t('print.previewNote')}</p>
                {LEGIBILITY_PT > 0 && !tooMany && (
                  <div className="stack-tight">
                    <div className="btn-row">
                      <button type="button" className="btn btn-primary" onClick={onPrint} disabled={busy}>
                        {t('print.printButton')}
                      </button>
                    </div>
                    <p className="hint">{t('print.printHint', { orientation: t(`print.${orientation}` as TKey) })}</p>
                    <div className="btn-row">
                      <button type="button" className="btn" onClick={() => void onPdf()} disabled={busy}>
                        {t('print.savePdf')}
                      </button>
                    </div>
                    <p className="hint">{t('print.savePdfHint', { count: sheetTotal })}</p>
                    <div className="btn-row">
                      <button type="button" className="btn" onClick={() => void onSvg()} disabled={busy}>
                        {t('print.saveSvg')}
                      </button>
                    </div>
                    <p className="hint">
                      {t('print.saveSvgHint')} {effectiveMode === 'tile' ? t('print.tileSvgNote') : ''}
                    </p>
                    <div className="btn-row" style={{ alignItems: 'flex-end' }}>
                      <div className="field">
                        <label htmlFor="pr-dpi">{t('print.pngDpi')}</label>
                        <select id="pr-dpi" className="select select-inline" value={dpi} onChange={(e) => setDpi(Number(e.target.value) as PngDpi)}>
                          {PNG_DPIS.map((d) => (
                            <option key={d} value={d} disabled={!pngSize(sheet.width, sheet.height, d).allowed}>
                              {`${d} dpi`}
                            </option>
                          ))}
                        </select>
                      </div>
                      <button type="button" className="btn" onClick={() => void onPng()} disabled={busy || !png.allowed}>
                        {t('print.savePng')}
                      </button>
                    </div>
                    <p className="hint tnum">{png.allowed ? t('print.pngSize', { width: formatNumber(locale, png.width), height: formatNumber(locale, png.height) }) : t('print.pngTooLarge', { dpi, width: formatNumber(locale, png.width), height: formatNumber(locale, png.height) })}</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </Dialog>
      {printing &&
        createPortal(
          <div id="print-root" aria-hidden="true">
            {printing.map((svg, i) => (
              <div key={i} className="print-page" dangerouslySetInnerHTML={{ __html: svg }} />
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}

/** Assembly plan on sheet 1: a small grid of numbered sheets in the top-left corner of the drawing area. */
function assemblyMarkup(drawing: { x: number; y: number; w: number; h: number }, tiling: { cols: number; rows: number; tiles: { index: number; col: number; row: number; viewBox: { x: number; y: number; w: number; h: number } }[] }, vb: { x: number; y: number; w: number; h: number }): string {
  const boxW = Math.min(vb.w * 0.28, 260), cellW = boxW / tiling.cols, cellH = (cellW * tiling.tiles[0]!.viewBox.h) / tiling.tiles[0]!.viewBox.w;
  const ox = vb.x + 8, oy = vb.y + 8;
  const parts = [`<rect x="${ox - 4}" y="${oy - 4}" width="${boxW + 8}" height="${cellH * tiling.rows + 8}" fill="${color.paper}" stroke="${color.rule}" stroke-width="1"/>`];
  for (const tl of tiling.tiles) {
    const x = ox + tl.col * cellW, y = oy + tl.row * cellH;
    parts.push(`<rect x="${x}" y="${y}" width="${cellW}" height="${cellH}" fill="none" stroke="${color.slate}" stroke-width="0.8"/><text x="${x + cellW / 2}" y="${y + cellH / 2 + 4}" font-size="${Math.max(8, Math.min(14, cellH / 3))}" fill="${color.ink}" text-anchor="middle">${tl.index}</text>`);
  }
  void drawing;
  return `<g>${parts.join('')}</g>`;
}
