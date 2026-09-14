import { useId } from 'react';
import { useT, formatNumber } from '@/i18n';
import { cssColor as color } from '@/design/tokens';

/**
 * Lean SVG charts. Every chart has a visible title, text labels on the marks, a description,
 * and a data table (in a disclosure) so nothing is conveyed by colour or shape alone.
 * Marks are thin, text uses the text tokens, the grid is recessive.
 */

export interface BarDatum {
  label: string;
  value: number;
}

/** Vertical bars for one series (no legend needed: the title names the series). */
export function BarChart({ title, hint, data, valueLabel, categoryLabel, basis, fill = color.line }: { title: string; hint?: string; data: BarDatum[]; valueLabel: string; categoryLabel: string; basis: string; fill?: string }) {
  const { t, locale } = useT();
  const id = useId();
  const w = 560, h = 240, padL = 40, padR = 12, padT = 16, padB = 44;
  const max = Math.max(1, ...data.map((d) => d.value));
  const innerW = w - padL - padR, innerH = h - padT - padB;
  const step = innerW / Math.max(1, data.length);
  const barW = Math.max(6, Math.min(40, step - 8));
  const ticks = niceTicks(max, 4);
  return (
    <figure className="chart" aria-labelledby={`${id}-title`} aria-describedby={`${id}-basis`}>
      <figcaption>
        <h3 id={`${id}-title`}>{title}</h3>
        {hint && <p className="hint">{hint}</p>}
        <p className="hint tnum" id={`${id}-basis`}>
          {basis}
        </p>
      </figcaption>
      {data.every((d) => d.value === 0) ? (
        <p className="muted">{t('stats.noData')}</p>
      ) : (
        <div className="chart-scroll">
          <svg viewBox={`0 0 ${w} ${h}`} width="100%" role="img" aria-label={t('stats.chart', { title })} style={{ maxWidth: w }}>
            {ticks.map((tick) => {
              const y = padT + innerH - (tick / max) * innerH;
              return (
                <g key={tick}>
                  <line x1={padL} x2={w - padR} y1={y} y2={y} stroke={color.ground} strokeWidth={1} />
                  <text x={padL - 6} y={y + 4} fontSize={12} fill={color.slate} textAnchor="end">
                    {formatNumber(locale, tick)}
                  </text>
                </g>
              );
            })}
            <line x1={padL} x2={w - padR} y1={padT + innerH} y2={padT + innerH} stroke={color.rule} strokeWidth={1} />
            {data.map((d, i) => {
              const x = padL + i * step + (step - barW) / 2;
              const bh = (d.value / max) * innerH;
              const y = padT + innerH - bh;
              return (
                <g key={d.label}>
                  <title>{`${d.label}: ${formatNumber(locale, d.value)}`}</title>
                  {bh > 0 && <rect x={x} y={y} width={barW} height={bh} fill={fill} rx={2} />}
                  {d.value > 0 && (
                    <text x={x + barW / 2} y={y - 4} fontSize={12} fill={color.ink} textAnchor="middle" fontWeight={500}>
                      {formatNumber(locale, d.value)}
                    </text>
                  )}
                  <text x={x + barW / 2} y={padT + innerH + 16} fontSize={12} fill={color.ink} textAnchor="middle">
                    {d.label.length > 9 && data.length > 8 ? `${d.label.slice(0, 8)}…` : d.label}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      )}
      <details className="chart-table">
        <summary>{t('stats.table')}</summary>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">{categoryLabel}</th>
                <th scope="col">{valueLabel}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.label}>
                  <th scope="row">{d.label}</th>
                  <td className="tnum">{formatNumber(locale, d.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}

/** Horizontal bars for ranked labels (names, places). */
export function RankedBars({ title, data, basis, valueLabel, categoryLabel }: { title: string; data: BarDatum[]; basis: string; valueLabel: string; categoryLabel: string }) {
  const { t, locale } = useT();
  const id = useId();
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <figure className="chart" aria-labelledby={`${id}-title`} aria-describedby={`${id}-basis`}>
      <figcaption>
        <h3 id={`${id}-title`}>{title}</h3>
        <p className="hint tnum" id={`${id}-basis`}>
          {basis}
        </p>
      </figcaption>
      {data.length === 0 ? (
        <p className="muted">{t('stats.noData')}</p>
      ) : (
        <ol className="ranked">
          {data.map((d) => (
            <li key={d.label}>
              <span className="ranked-label">{d.label}</span>
              <span className="ranked-bar" aria-hidden="true">
                <span className="ranked-fill" style={{ width: `${(d.value / max) * 100}%` }} />
              </span>
              <span className="ranked-value tnum">{formatNumber(locale, d.value)}</span>
            </li>
          ))}
        </ol>
      )}
      <details className="chart-table">
        <summary>{t('stats.table')}</summary>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">{categoryLabel}</th>
                <th scope="col">{valueLabel}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.label}>
                  <th scope="row">{d.label}</th>
                  <td className="tnum">{formatNumber(locale, d.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}

export interface SeriesPoint {
  x: string;
  values: (number | null)[];
  ns: number[];
}

/** Grouped bars for up to three series with a legend and direct labels. */
export function GroupedBars({ title, hint, series, points, basis, xLabel }: { title: string; hint?: string; series: { label: string; color: string; pattern?: boolean }[]; points: SeriesPoint[]; basis: string; xLabel: string }) {
  const { t, locale } = useT();
  const id = useId();
  const w = 620, h = 260, padL = 40, padR = 12, padT = 16, padB = 44;
  const values = points.flatMap((p) => p.values.filter((v): v is number => v !== null));
  const max = Math.max(1, ...values);
  const innerW = w - padL - padR, innerH = h - padT - padB;
  const step = innerW / Math.max(1, points.length);
  const barW = Math.max(4, Math.min(16, (step - 10) / series.length));
  const ticks = niceTicks(max, 4);
  return (
    <figure className="chart" aria-labelledby={`${id}-title`} aria-describedby={`${id}-basis`}>
      <figcaption>
        <h3 id={`${id}-title`}>{title}</h3>
        {hint && <p className="hint">{hint}</p>}
        <p className="hint tnum" id={`${id}-basis`}>
          {basis}
        </p>
      </figcaption>
      {values.length === 0 ? (
        <p className="muted">{t('stats.noData')}</p>
      ) : (
        <>
          <ul className="chart-legend" aria-label={t('tree.legend')}>
            {series.map((s) => (
              <li key={s.label}>
                <span className="swatch" style={{ background: s.pattern ? `repeating-linear-gradient(45deg, ${s.color} 0 2px, transparent 2px 5px)` : s.color, borderColor: s.color }} aria-hidden="true" />
                {s.label}
              </li>
            ))}
          </ul>
          <div className="chart-scroll">
            <svg viewBox={`0 0 ${w} ${h}`} width="100%" role="img" aria-label={t('stats.chart', { title })} style={{ maxWidth: w }}>
              <defs>
                <pattern id={`${id}-hatch`} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                  <rect width="2" height="5" fill={series[2]?.color ?? color.warn} />
                </pattern>
              </defs>
              {ticks.map((tick) => {
                const y = padT + innerH - (tick / max) * innerH;
                return (
                  <g key={tick}>
                    <line x1={padL} x2={w - padR} y1={y} y2={y} stroke={color.ground} strokeWidth={1} />
                    <text x={padL - 6} y={y + 4} fontSize={12} fill={color.slate} textAnchor="end">
                      {formatNumber(locale, tick)}
                    </text>
                  </g>
                );
              })}
              <line x1={padL} x2={w - padR} y1={padT + innerH} y2={padT + innerH} stroke={color.rule} strokeWidth={1} />
              {points.map((p, i) => {
                const groupX = padL + i * step + (step - barW * series.length - 2 * (series.length - 1)) / 2;
                return (
                  <g key={p.x}>
                    {series.map((s, k) => {
                      const v = p.values[k];
                      if (v === null || v === undefined) return null;
                      const bh = (v / max) * innerH;
                      const x = groupX + k * (barW + 2);
                      const y = padT + innerH - bh;
                      return (
                        <g key={s.label}>
                          <title>{`${p.x} · ${s.label}: ${formatNumber(locale, v)} (${formatNumber(locale, p.ns[k] ?? 0)})`}</title>
                          <rect x={x} y={y} width={barW} height={bh} fill={s.pattern ? `url(#${id}-hatch)` : s.color} stroke={s.pattern ? s.color : undefined} strokeWidth={s.pattern ? 1 : 0} rx={2} />
                          <text x={x + barW / 2} y={y - 3} fontSize={10} fill={color.ink} textAnchor="middle">
                            {formatNumber(locale, Math.round(v))}
                          </text>
                        </g>
                      );
                    })}
                    <text x={padL + i * step + step / 2} y={padT + innerH + 16} fontSize={12} fill={color.ink} textAnchor="middle">
                      {p.x}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </>
      )}
      <details className="chart-table">
        <summary>{t('stats.table')}</summary>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">{xLabel}</th>
                {series.map((s) => (
                  <th key={s.label} scope="col">
                    {s.label} ({t('stats.mean')} / {t('stats.n')})
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.x}>
                  <th scope="row">{p.x}</th>
                  {series.map((s, k) => (
                    <td key={s.label} className="tnum">
                      {p.values[k] === null || p.values[k] === undefined ? '–' : `${formatNumber(locale, p.values[k])} / ${formatNumber(locale, p.ns[k] ?? 0)}`}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}

function niceTicks(max: number, count: number): number[] {
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const stepN = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
  const out: number[] = [];
  for (let v = 0; v <= max; v += stepN) out.push(Math.round(v * 100) / 100);
  return out;
}
