import { useMemo } from 'react';
import { useT, formatNumber, intlTag } from '@/i18n';
import type { TKey } from '@/i18n';
import { useAppStore } from '@/store/store';
import { computeStatistics } from '@/timeline/statistics';
import { color } from '@/design/tokens';
import { BarChart, GroupedBars, RankedBars } from './charts';
import { openPrint } from '../print/printStore';

/** Statistics mode. Every metric states its base population. */
export function StatisticsView() {
  const { t, locale } = useT();
  const project = useAppStore((s) => s.project);
  const s = useMemo(() => (project ? computeStatistics(project) : null), [project]);
  if (!project || !s) return null;
  const basis = (base: number, total: number) => t('stats.basis', { base: formatNumber(locale, base), total: formatNumber(locale, total) });
  const months = Array.from({ length: 12 }, (_, i) => new Intl.DateTimeFormat(intlTag[locale], { month: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(2000, i, 1))));
  const sexLabel = (k: string) => t(`person.sexValue.${k}` as TKey);
  const statusLabel = (k: string) => t(`person.lifeStatusValue.${k}` as TKey);

  return (
    <div className="page stats-page">
      <div className="stack-tight">
        <h2>{t('stats.title')}</h2>
        <p className="muted">{t('stats.intro')}</p>
        <div className="btn-row">
          <button type="button" className="btn" onClick={() => openPrint({ defaultContent: 'statistics' })}>
            {t('print.open')}
          </button>
        </div>
      </div>
      <dl className="stat-tiles">
        <div className="stat-tile">
          <dt>{t('stats.people')}</dt>
          <dd className="tnum">{formatNumber(locale, s.people)}</dd>
        </div>
        <div className="stat-tile">
          <dt>{t('stats.unions')}</dt>
          <dd className="tnum">{formatNumber(locale, s.unions)}</dd>
        </div>
        <div className="stat-tile">
          <dt>{t('stats.generations')}</dt>
          <dd className="tnum">{formatNumber(locale, s.generations)}</dd>
        </div>
        <div className="stat-tile">
          <dt>{t('stats.birthYears')}</dt>
          <dd className="tnum">{s.birthYears ? t('stats.birthYearsRange', { from: s.birthYears.min, to: s.birthYears.max }) : t('stats.noData')}</dd>
        </div>
      </dl>

      <div className="chart-grid">
        <BarChart title={t('stats.sexes')} data={(['female', 'male', 'diverse', 'unknown'] as const).map((k) => ({ label: sexLabel(k), value: s.sexes.value[k] }))} basis={basis(s.sexes.base, s.sexes.total)} valueLabel={t('stats.count')} categoryLabel={t('stats.sexes')} />
        <BarChart title={t('stats.lifeStatus')} data={(['living', 'deceased', 'unknown'] as const).map((k) => ({ label: statusLabel(k), value: s.lifeStatus.value[k] }))} basis={basis(s.lifeStatus.base, s.lifeStatus.total)} valueLabel={t('stats.count')} categoryLabel={t('stats.lifeStatus')} />
        <BarChart title={t('stats.ageAtDeath')} hint={t('stats.ageAtDeathHint')} data={s.ageAtDeath.value.map((b) => ({ label: b.label, value: b.count }))} basis={basis(s.ageAtDeath.base, s.ageAtDeath.total)} valueLabel={t('stats.count')} categoryLabel={t('stats.ageGroup')} />
        <GroupedBars
          title={t('stats.lifeExpectancy')}
          hint={t('stats.lifeExpectancyHint')}
          series={[
            // Validated categorical trio (lightness band, chroma floor, CVD separation): see DECISIONS.md #108.
            { label: t('stats.all'), color: '#178A5C' },
            { label: t('stats.male'), color: color.select },
            { label: t('stats.female'), color: '#B3741A', pattern: true },
          ]}
          points={s.lifeExpectancyByDecade.value.map((d) => ({ x: `${d.decade}`, values: [d.all?.mean ?? null, d.male?.mean ?? null, d.female?.mean ?? null], ns: [d.all?.n ?? 0, d.male?.n ?? 0, d.female?.n ?? 0] }))}
          basis={basis(s.lifeExpectancyByDecade.base, s.lifeExpectancyByDecade.total)}
          xLabel={t('stats.decade')}
        />
        <figure className="chart">
          <figcaption>
            <h3>{t('stats.ageAtMarriage')}</h3>
            <p className="hint tnum">{t('stats.basisPartners', { base: formatNumber(locale, s.ageAtMarriage.base), total: formatNumber(locale, s.ageAtMarriage.total) })}</p>
          </figcaption>
          {s.ageAtMarriage.base === 0 ? (
            <p className="muted">{t('stats.noData')}</p>
          ) : (
            <ul className="plain-list">
              <li>{t('stats.ageAtMarriageLine', { sex: t('stats.all'), age: formatNumber(locale, s.ageAtMarriage.value.all.mean), n: t('common.people', { count: s.ageAtMarriage.value.all.n }) })}</li>
              {s.ageAtMarriage.value.male && <li>{t('stats.ageAtMarriageLine', { sex: t('stats.male'), age: formatNumber(locale, s.ageAtMarriage.value.male.mean), n: t('common.people', { count: s.ageAtMarriage.value.male.n }) })}</li>}
              {s.ageAtMarriage.value.female && <li>{t('stats.ageAtMarriageLine', { sex: t('stats.female'), age: formatNumber(locale, s.ageAtMarriage.value.female.mean), n: t('common.people', { count: s.ageAtMarriage.value.female.n }) })}</li>}
            </ul>
          )}
        </figure>
        <BarChart title={t('stats.childrenPerUnion')} hint={t('stats.childrenPerUnionHint')} data={s.childrenPerUnion.value.map((b) => ({ label: b.label, value: b.count }))} basis={t('stats.basisUnions', { base: formatNumber(locale, s.childrenPerUnion.base), total: formatNumber(locale, s.childrenPerUnion.total) })} valueLabel={t('stats.count')} categoryLabel={t('stats.children')} />
        <BarChart title={t('stats.birthMonths')} hint={t('stats.birthMonthsHint')} data={s.birthMonths.value.map((v, i) => ({ label: months[i]!, value: v }))} basis={basis(s.birthMonths.base, s.birthMonths.total)} valueLabel={t('stats.count')} categoryLabel={t('stats.month')} />
        <RankedBars title={t('stats.givenNames')} data={s.givenNames.value.map((b) => ({ label: b.label, value: b.count }))} basis={basis(s.givenNames.base, s.givenNames.total)} valueLabel={t('stats.count')} categoryLabel={t('stats.value')} />
        <RankedBars title={t('stats.surnames')} data={s.surnames.value.map((b) => ({ label: b.label, value: b.count }))} basis={basis(s.surnames.base, s.surnames.total)} valueLabel={t('stats.count')} categoryLabel={t('stats.value')} />
        <RankedBars title={t('stats.occupations')} data={s.occupations.value.map((b) => ({ label: b.label, value: b.count }))} basis={basis(s.occupations.base, s.occupations.total)} valueLabel={t('stats.count')} categoryLabel={t('stats.value')} />
        <RankedBars title={t('stats.places')} data={s.places.value.map((b) => ({ label: b.label, value: b.count }))} basis={basis(s.places.base, s.places.total)} valueLabel={t('stats.count')} categoryLabel={t('stats.value')} />
      </div>
    </div>
  );
}
