import { useMemo, useState } from 'react';
import { useT, formatNumber } from '@/i18n';
import { personName } from '@/model/types';
import { useAppStore, updateUi } from '@/store/store';
import { computeTimeline, sortBars } from '@/timeline/timeline';
import type { TimelineSort } from '@/timeline/timeline';
import { HISTORY } from '@/timeline/history';
import { color } from '@/design/tokens';
import { cardText } from '@/render/geometry';
import { useRouter } from '../router';
import { openPrint } from '../print/printStore';

const ROW = 30;
const LABEL_W = 180;
const STEPS = [2, 4, 8, 16]; // pixels per year

/** Timeline mode: one lifespan bar per person; choosing a bar shows the person in the tree. */
export function TimelineView() {
  const { t, locale } = useT();
  const project = useAppStore((s) => s.project);
  const go = useRouter((s) => s.go);
  const [sort, setSort] = useState<TimelineSort>('birth');
  const [zoom, setZoom] = useState(1);
  const [history, setHistory] = useState(false);
  const data = useMemo(() => (project ? computeTimeline(project) : null), [project]);
  const bars = useMemo(() => (project && data ? sortBars(data.bars, sort, project) : []), [project, data, sort]);
  if (!project || !data) return null;

  const pxPerYear = STEPS[zoom]!;
  const years = data.maxYear - data.minYear;
  const width = LABEL_W + years * pxPerYear + 40;
  const height = 40 + bars.length * ROW + 20;
  const x = (year: number) => LABEL_W + (year - data.minYear) * pxPerYear;
  const tickEvery = pxPerYear >= 8 ? 10 : pxPerYear >= 4 ? 25 : 50;
  const ticks: number[] = [];
  for (let y = data.minYear; y <= data.maxYear; y += tickEvery) ticks.push(y);
  const currentYear = new Date().getUTCFullYear();
  const jump = (id: string) => {
    updateUi({ selectedPersonId: id, viewport: null });
    go('tree');
  };

  return (
    <div className="page timeline-page">
      <div className="stack-tight">
        <h2>{t('timeline.title')}</h2>
        <p className="muted">{t('timeline.intro')}</p>
      </div>
      <div className="btn-row timeline-controls">
        <div className="field">
          <label htmlFor="timeline-sort">{t('timeline.sort')}</label>
          <select id="timeline-sort" className="select select-inline" value={sort} onChange={(e) => setSort(e.target.value as TimelineSort)}>
            <option value="birth">{t('timeline.sortBirth')}</option>
            <option value="family">{t('timeline.sortFamily')}</option>
          </select>
        </div>
        <div className="btn-row" role="group" aria-label={t('timeline.scale', { years: tickEvery })}>
          <button type="button" className="btn" onClick={() => setZoom((z) => Math.max(0, z - 1))} disabled={zoom === 0}>
            {t('timeline.zoomOut')}
          </button>
          <button type="button" className="btn" onClick={() => setZoom((z) => Math.min(STEPS.length - 1, z + 1))} disabled={zoom === STEPS.length - 1}>
            {t('timeline.zoomIn')}
          </button>
        </div>
        <button type="button" className="btn" onClick={() => openPrint({ defaultContent: 'timeline' })}>
          {t('print.open')}
        </button>
        <div className="radio-row">
          <input id="timeline-history" type="checkbox" checked={history} onChange={(e) => setHistory(e.target.checked)} aria-describedby="timeline-history-note" />
          <span>
            <label htmlFor="timeline-history">{t('timeline.history')}</label>
            <span className="hint" id="timeline-history-note">
              {t('timeline.historyNote')}
            </span>
          </span>
        </div>
      </div>
      <ul className="chart-legend" aria-label={t('tree.legend')}>
        <li>
          <span className="swatch" style={{ background: color.ink, borderColor: color.ink }} aria-hidden="true" />
          {t('timeline.legend.closed')}
        </li>
        <li>
          <span className="swatch" style={{ background: color.line, borderColor: color.line }} aria-hidden="true" />
          {t('timeline.legend.living')}
        </li>
        <li>
          <span className="swatch swatch-faded" aria-hidden="true" />
          {t('timeline.legend.unknown')}
        </li>
        <li>
          <span className="swatch swatch-dashed" aria-hidden="true" />
          {t('timeline.legend.uncertain')}
        </li>
      </ul>
      {bars.length === 0 ? (
        <p className="muted">{t('timeline.empty')}</p>
      ) : (
        <div className="timeline-scroll">
          <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="group" aria-label={t('timeline.chartLabel', { count: bars.length, from: data.minYear, to: data.maxYear })} className="timeline-svg">
            {history &&
              HISTORY.map((h) => (
                <g key={h.label.en}>
                  <rect x={x(h.from)} y={20} width={Math.max(2, (h.to - h.from + 1) * pxPerYear)} height={height - 40} fill={color.warnBg} />
                  <text x={x(h.from) + 2} y={14} fontSize={11} fill={color.warn}>
                    {locale === 'de' ? h.label.de : h.label.en}
                  </text>
                </g>
              ))}
            {ticks.map((y) => (
              <g key={y}>
                <line x1={x(y)} x2={x(y)} y1={24} y2={height - 20} stroke={color.ground} strokeWidth={1} />
                <text x={x(y)} y={history ? 34 : 18} fontSize={12} fill={color.slate} textAnchor="middle">
                  {y}
                </text>
              </g>
            ))}
            {bars.map((b, i) => {
              const p = project.persons[b.personId]!;
              const y = 40 + i * ROW;
              const name = personName(p) || t('person.unnamed');
              const yearsText = cardText(p, 'minimal', locale).lines[0] ?? '';
              const stroke = b.kind === 'living' ? color.line : color.ink;
              const fill = b.kind === 'unknownEnd' ? 'none' : stroke;
              return (
                <g key={b.personId} className="timeline-row" tabIndex={0} role="button" aria-label={t('timeline.showInTree', { name })} onClick={() => jump(b.personId)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), jump(b.personId))}>
                  <title>{t('timeline.barLabel', { name, years: yearsText })}</title>
                  <rect x={0} y={y} width={width} height={ROW} fill="transparent" />
                  <text x={LABEL_W - 8} y={y + 19} fontSize={14} fill={color.ink} textAnchor="end">
                    {name.length > 24 ? `${name.slice(0, 23)}…` : name}
                  </text>
                  <rect x={x(b.start)} y={y + 8} width={Math.max(3, (b.end - b.start) * pxPerYear)} height={14} fill={fill} fillOpacity={b.kind === 'unknownEnd' ? 0 : 1} stroke={stroke} strokeWidth={b.kind === 'unknownEnd' ? 1.5 : 0} strokeDasharray={b.kind === 'unknownEnd' ? '4 3' : undefined} opacity={b.kind === 'unknownEnd' ? 0.6 : 1} rx={2} />
                  {b.startUncertain && <line x1={x(b.start)} x2={x(b.start)} y1={y + 5} y2={y + 25} stroke={color.paper} strokeWidth={2} strokeDasharray="2 2" />}
                  {b.endUncertain && <line x1={x(b.end)} x2={x(b.end)} y1={y + 5} y2={y + 25} stroke={color.paper} strokeWidth={2} strokeDasharray="2 2" />}
                  {b.kind === 'living' && <path d={`M${x(currentYear)} ${y + 8} l6 7 -6 7`} fill="none" stroke={color.line} strokeWidth={2} />}
                  <text x={x(b.end) + (b.kind === 'living' ? 10 : 6)} y={y + 19} fontSize={12} fill={color.slate}>
                    {yearsText}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      )}
      {data.undated.length > 0 && <p className="hint">{t('timeline.undated', { count: data.undated.length })}</p>}
      <p className="hint tnum">{t('timeline.scale', { years: formatNumber(locale, tickEvery) })}</p>
    </div>
  );
}
