import { useId, useState } from 'react'
import { ChevronDown, TrendingUp } from 'lucide-react'
import SectionTitle from '@/components/common/SectionTitle.jsx'
import { Icon, Panel } from '@/components/ui'
import { cx } from '@/utils/cx.js'
import { ACTIVITY_PERIODS, BAR_SCALE_MAX } from '../data/overview.js'
import styles from './PlatformActivityCard.module.css'

/* Line view geometry (viewBox units; the SVG scales to the card width). */
const WIDTH = 756
const HEIGHT = 244
const PLOT = { left: 38.5, right: 746, top: 8, bottom: 224.5 }
const TICKS = [0, 20, 40, 60, 80, 100]

const yOf = (value) => PLOT.bottom - (value / 100) * (PLOT.bottom - PLOT.top)

function ViewToggle({ view, onChange }) {
  return (
    <div className={styles.toggle} role="group" aria-label="Chart view">
      <button
        type="button"
        className={cx(styles.toggleButton, view === 'bars' && styles.toggleActive)}
        aria-pressed={view === 'bars'}
        aria-label="Bar view"
        onClick={() => onChange('bars')}
      >
        <span className={styles.barsIcon} aria-hidden="true" />
      </button>
      <button
        type="button"
        className={cx(styles.toggleButton, view === 'line' && styles.toggleActive)}
        aria-pressed={view === 'line'}
        aria-label="Line view"
        onClick={() => onChange('line')}
      >
        <Icon as={TrendingUp} size={12} />
      </button>
    </div>
  )
}

function BarChart({ data }) {
  return (
    <>
      <div className={styles.bars}>
        {data.days.map((day, index) => (
          <div key={day} className={styles.barColumn}>
            <span
              className={cx(styles.bar, styles.registrationBar)}
              style={{ height: `${(data.registrations[index] / BAR_SCALE_MAX) * 100}%` }}
            />
            <span
              className={cx(styles.bar, styles.applicationBar)}
              style={{ height: `${(data.applications[index] / BAR_SCALE_MAX) * 100}%` }}
            />
          </div>
        ))}
      </div>
      <div className={styles.barLabels} aria-hidden="true">
        {data.days.map((day) => (
          <span key={day} className={styles.barLabel}>
            {day}
          </span>
        ))}
      </div>
    </>
  )
}

function LineChart({ data }) {
  const gradientId = useId().replace(/\W/g, '')
  const band = (PLOT.right - PLOT.left) / data.days.length
  const xOf = (index) => PLOT.left + band * (index + 0.5)
  const series = [
    { values: data.applications, line: styles.applicationLine, dot: styles.applicationDot, halo: styles.applicationHalo, fill: 'applications' },
    { values: data.registrations, line: styles.registrationLine, dot: styles.registrationDot, halo: styles.registrationHalo, fill: 'registrations' },
  ]

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className={styles.lineSvg} aria-hidden="true">
      <defs>
        <linearGradient id={`${gradientId}-registrations`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0084ff" stopOpacity="0.3" />
          <stop offset="1" stopColor="#0084ff" stopOpacity="0.04" />
        </linearGradient>
        <linearGradient id={`${gradientId}-applications`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0084ff" stopOpacity="0.07" />
          <stop offset="1" stopColor="#0084ff" stopOpacity="0.01" />
        </linearGradient>
      </defs>

      {TICKS.map((tick) => (
        <g key={tick}>
          {tick > 0 && <line x1={PLOT.left} x2={PLOT.right} y1={yOf(tick)} y2={yOf(tick)} className={styles.grid} />}
          <text x={PLOT.left - 6} y={yOf(tick)} dy="0.35em" textAnchor="end" className={styles.tick}>
            {tick}
          </text>
        </g>
      ))}
      {Array.from({ length: data.days.length + 1 }, (_, index) => (
        <line key={index} x1={PLOT.left + band * index} x2={PLOT.left + band * index} y1={PLOT.top} y2={PLOT.bottom} className={styles.grid} />
      ))}
      <line x1={PLOT.left} x2={PLOT.right} y1={PLOT.bottom} y2={PLOT.bottom} className={styles.axis} />

      {series.map(({ values, line, dot, halo, fill }) => {
        const points = values.map((value, index) => `${xOf(index)},${yOf(value)}`)
        return (
          <g key={fill}>
            <polygon
              points={`${xOf(0)},${PLOT.bottom} ${points.join(' ')} ${xOf(values.length - 1)},${PLOT.bottom}`}
              fill={`url(#${gradientId}-${fill})`}
            />
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

      {data.days.map((day, index) => (
        <text key={day} x={xOf(index)} y={PLOT.bottom + 13} dy="0.35em" textAnchor="middle" className={styles.tick}>
          {day}
        </text>
      ))}
    </svg>
  )
}

/** "Platform activity": illustrative registrations vs applications as bars or a line, per period. */
export default function PlatformActivityCard() {
  const [view, setView] = useState('bars')
  const [periodId, setPeriodId] = useState(ACTIVITY_PERIODS[0].id)
  const period = ACTIVITY_PERIODS.find((item) => item.id === periodId)
  const data = view === 'bars' ? period.bars : period.line
  const summary = `${period.label} activity by day. Registrations: ${data.registrations.join(', ')}. Applications: ${data.applications.join(', ')}.`

  return (
    <Panel padding={24} aria-labelledby="platform-activity-title" className={cx(styles.card, view === 'line' && styles.lineView)}>
      <SectionTitle id="platform-activity-title" title="Platform activity" description="Illustrative registrations and applications">
        <div className={styles.controls}>
          <ViewToggle view={view} onChange={setView} />
          <label className={styles.period}>
            <span className="sr-only">Period</span>
            <select value={periodId} onChange={(event) => setPeriodId(event.target.value)} className={styles.select}>
              {ACTIVITY_PERIODS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
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
          Registrations
        </li>
        <li className={styles.legendItem}>
          <span className={cx(styles.swatch, styles.applicationSwatch)} />
          Applications
        </li>
      </ul>

      <div className={styles.chart} role="img" aria-label={summary}>
        {view === 'bars' ? <BarChart data={data} /> : <LineChart data={data} />}
      </div>
    </Panel>
  )
}
