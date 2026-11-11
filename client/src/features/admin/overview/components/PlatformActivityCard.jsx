import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, TrendingUp } from 'lucide-react'
import SectionTitle from '@/components/common/SectionTitle.jsx'
import { Icon, Panel, Skeleton, SkeletonRegion } from '@/components/ui'
import { niceCeiling } from '../chartScale.js'
import { cx } from '@/utils/cx.js'
import { PERIODS, useActivity } from '../useActivity.js'
import styles from './PlatformActivityCard.module.css'

/* Line view geometry (viewBox units; the SVG scales to the card width). */
const WIDTH = 756
const HEIGHT = 244
const PLOT = { left: 38.5, right: 746, top: 8, bottom: 224.5 }

function ViewToggle({ view, onChange }) {
  const { t } = useTranslation('adminOverview')
  return (
    <div className={styles.toggle} role="group" aria-label={t('chart.view')}>
      <button
        type="button"
        className={cx(styles.toggleButton, view === 'bars' && styles.toggleActive)}
        aria-pressed={view === 'bars'}
        aria-label={t('chart.bars')}
        onClick={() => onChange('bars')}
      >
        <span className={styles.barsIcon} aria-hidden="true" />
      </button>
      <button
        type="button"
        className={cx(styles.toggleButton, view === 'line' && styles.toggleActive)}
        aria-pressed={view === 'line'}
        aria-label={t('chart.line')}
        onClick={() => onChange('line')}
      >
        <Icon as={TrendingUp} size={12} />
      </button>
    </div>
  )
}

function BarChart({ data }) {
  const ceiling = niceCeiling(Math.max(...data.registrations, ...data.applications))
  return (
    <>
      <div className={styles.bars}>
        {data.labels.map((label, index) => (
          <div key={label} className={styles.barColumn}>
            <span className={cx(styles.bar, styles.registrationBar)} style={{ height: `${(data.registrations[index] / ceiling) * 100}%` }} />
            <span className={cx(styles.bar, styles.applicationBar)} style={{ height: `${(data.applications[index] / ceiling) * 100}%` }} />
          </div>
        ))}
      </div>
      <div className={styles.barLabels} aria-hidden="true">
        {data.labels.map((label) => (
          <span key={label} className={styles.barLabel}>
            {label}
          </span>
        ))}
      </div>
    </>
  )
}

function LineChart({ data }) {
  const gradientId = useId().replace(/\W/g, '')
  // M-171: the same real counts as the bars, on an axis scaled to them.
  const ceiling = niceCeiling(Math.max(...data.registrations, ...data.applications))
  const ticks = Array.from({ length: 6 }, (_, index) => (ceiling / 5) * index)
  const yOf = (value) => PLOT.bottom - (value / ceiling) * (PLOT.bottom - PLOT.top)
  const band = (PLOT.right - PLOT.left) / data.labels.length
  const xOf = (index) => PLOT.left + band * (index + 0.5)
  const series = [
    { values: data.applications, line: styles.applicationLine, dot: styles.applicationDot, halo: styles.applicationHalo, fill: 'applications' },
    { values: data.registrations, line: styles.registrationLine, dot: styles.registrationDot, halo: styles.registrationHalo, fill: 'registrations' },
  ]
  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className={styles.lineSvg} aria-hidden="true">
      <defs>
        <linearGradient id={`${gradientId}-registrations`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0263dc" stopOpacity="0.3" />
          <stop offset="1" stopColor="#0263dc" stopOpacity="0.04" />
        </linearGradient>
        <linearGradient id={`${gradientId}-applications`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0263dc" stopOpacity="0.07" />
          <stop offset="1" stopColor="#0263dc" stopOpacity="0.01" />
        </linearGradient>
      </defs>
      {ticks.map((tick) => (
        <g key={tick}>
          {tick > 0 && <line x1={PLOT.left} x2={PLOT.right} y1={yOf(tick)} y2={yOf(tick)} className={styles.grid} />}
          <text x={PLOT.left - 6} y={yOf(tick)} dy="0.35em" textAnchor="end" className={styles.tick}>
            {tick}
          </text>
        </g>
      ))}
      {Array.from({ length: data.labels.length + 1 }, (_, index) => (
        <line key={index} x1={PLOT.left + band * index} x2={PLOT.left + band * index} y1={PLOT.top} y2={PLOT.bottom} className={styles.grid} />
      ))}
      <line x1={PLOT.left} x2={PLOT.right} y1={PLOT.bottom} y2={PLOT.bottom} className={styles.axis} />
      {series.map(({ values, line, dot, halo, fill }) => {
        const points = values.map((value, index) => `${xOf(index)},${yOf(value)}`)
        return (
          <g key={fill}>
            <polygon points={`${xOf(0)},${PLOT.bottom} ${points.join(' ')} ${xOf(values.length - 1)},${PLOT.bottom}`} fill={`url(#${gradientId}-${fill})`} />
            <polyline points={points.join(' ')} className={line} />
            {values.map((value, index) => (
              <g key={index}>
                <circle cx={xOf(index)} cy={yOf(value)} r="6.5" className={halo} />
                <circle cx={xOf(index)} cy={yOf(value)} r="3" className={dot} />
              </g>
            ))}
          </g>
        )
      })}
      {data.labels.map((label, index) => (
        <text key={label} x={xOf(index)} y={PLOT.bottom + 13} dy="0.35em" textAnchor="middle" className={styles.tick}>
          {label}
        </text>
      ))}
    </svg>
  )
}

/* Bar heights (% of the plot) of the placeholder week: registrations, applications. */
const SKELETON_BARS = [
  [46, 30],
  [62, 40],
  [38, 24],
  [74, 52],
  [54, 36],
  [30, 18],
  [44, 28],
]

/** The bar chart's shape while the counts load. */
function ChartSkeleton() {
  return (
    <SkeletonRegion className={styles.chart}>
      <div className={styles.bars}>
        {SKELETON_BARS.map(([registrations, applications], index) => (
          <div key={index} className={styles.barColumn}>
            <Skeleton shape="block" width={20} height={`${registrations}%`} className={styles.skeletonBar} />
            <Skeleton shape="block" width={20} height={`${applications}%`} className={styles.skeletonBar} />
          </div>
        ))}
      </div>
      <div className={styles.barLabels}>
        {SKELETON_BARS.map((_, index) => (
          <span key={index} className={styles.barLabel}>
            <Skeleton width={24} height={8} />
          </span>
        ))}
      </div>
    </SkeletonRegion>
  )
}

/** "Platform activity" (M-170, M-171): real registrations and applications per day or week, as bars or a line. */
export default function PlatformActivityCard({ country }) {
  const { t } = useTranslation(['adminOverview', 'enums'])
  const [view, setView] = useState('bars')
  const [period, setPeriod] = useState(PERIODS[0])
  const { data, loading, busy } = useActivity('overview', period, country)
  const summary =
    data &&
    t('chart.summary', {
      period: t(`enums:reportPeriod.${period}`),
      items: data.labels.map((label, index) => t('chart.point', { label, registrations: data.registrations[index], applications: data.applications[index] })).join('; '),
    })
  return (
    <Panel padding={24} aria-labelledby="platform-activity-title" className={cx(styles.card, view === 'line' && styles.lineView)}>
      <SectionTitle id="platform-activity-title" title={t('chart.title')} description={t('chart.description')}>
        <div className={styles.controls}>
          <ViewToggle view={view} onChange={setView} />
          <label className={styles.period}>
            <span className="sr-only">{t('chart.period')}</span>
            <select name="period" value={period} onChange={(event) => setPeriod(event.target.value)} className={styles.select}>
              {PERIODS.map((item) => (
                <option key={item} value={item}>
                  {t(`enums:reportPeriod.${item}`)}
                </option>
              ))}
            </select>
            <Icon as={ChevronDown} size={10} className={styles.chevron} />
          </label>
        </div>
      </SectionTitle>
      <ul className={styles.legend}>
        <li className={styles.legendItem}>
          <span className={cx(styles.swatch, styles.registrationSwatch)} />
          {t('chart.registrations')}
        </li>
        <li className={styles.legendItem}>
          <span className={cx(styles.swatch, styles.applicationSwatch)} />
          {t('chart.applications')}
        </li>
      </ul>
      {loading ? (
        <ChartSkeleton />
      ) : (
        <div className={cx(styles.chart, busy && styles.busy)} role="img" aria-label={summary ?? ''} aria-busy={busy || undefined} data-activity-chart={data ? period : undefined}>
          {data && (view === 'bars' ? <BarChart data={data} /> : <LineChart data={data} />)}
        </div>
      )}
    </Panel>
  )
}
