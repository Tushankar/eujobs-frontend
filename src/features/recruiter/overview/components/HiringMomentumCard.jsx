import { useState } from 'react'
import { ChevronDown, TrendingUp } from 'lucide-react'
import { cx } from '@/utils/cx.js'
import { Icon } from '@/components/ui'
import { MOMENTUM_DAYS, MOMENTUM_PERIODS } from '../data/overview.js'
import SectionHeading from './SectionHeading.jsx'
import styles from './HiringMomentumCard.module.css'

const SCALE_MAX = 25
const percent = (value) => `${(value / SCALE_MAX) * 100}%`

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

function LineChart({ applications, shortlisted }) {
  const points = (values) =>
    values.map((value, index) => `${(index + 0.5) * 100},${175 - (value / SCALE_MAX) * 175}`).join(' ')
  return (
    <div className={styles.lineLayer} aria-hidden="true">
      <svg viewBox="0 0 700 175" preserveAspectRatio="none" className={styles.lineSvg}>
        <polyline points={points(shortlisted)} className={styles.shortlistLine} />
        <polyline points={points(applications)} className={styles.applicationLine} />
      </svg>
      {[
        [shortlisted, styles.shortlistDot],
        [applications, styles.applicationDot],
      ].map(([values, dotClass]) =>
        values.map((value, index) => (
          <span
            key={`${dotClass}-${index}`}
            className={cx(styles.dot, dotClass)}
            style={{ left: `${((index + 0.5) / 7) * 100}%`, bottom: percent(value) }}
          />
        )),
      )}
    </div>
  )
}

/** "Hiring momentum": illustrative applications vs shortlisted activity, as bars or a line, per period. */
export default function HiringMomentumCard() {
  const [view, setView] = useState('bars')
  const [periodId, setPeriodId] = useState(MOMENTUM_PERIODS[0].id)
  const period = MOMENTUM_PERIODS.find((item) => item.id === periodId)
  const summary = `${period.label} activity. Applications: ${period.applications.join(', ')}. Shortlisted: ${period.shortlisted.join(', ')}.`

  return (
    <section className={styles.card} aria-labelledby="momentum-title">
      <div className={styles.head}>
        <SectionHeading
          id="momentum-title"
          title="Hiring momentum"
          description="Illustrative activity across your open roles"
        />
        <div className={styles.controls}>
          <ViewToggle view={view} onChange={setView} />
          <label className={styles.period}>
            <span className="sr-only">Period</span>
            <select value={periodId} onChange={(event) => setPeriodId(event.target.value)} className={styles.select}>
              {MOMENTUM_PERIODS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
            <Icon as={ChevronDown} size={10} className={styles.chevron} />
          </label>
        </div>
      </div>

      <ul className={styles.legend}>
        <li className={styles.legendItem}>
          <span className={cx(styles.swatch, styles.applicationSwatch)} />
          Applications
        </li>
        <li className={styles.legendItem}>
          <span className={cx(styles.swatch, styles.shortlistSwatch)} />
          Shortlisted
        </li>
      </ul>

      <div className={styles.chart} role="img" aria-label={summary}>
        <div className={cx(styles.plot, view === 'line' && styles.plotLine)}>
          {MOMENTUM_DAYS.map((day, index) => (
            <div key={day} className={styles.column}>
              {view === 'bars' && (
                <>
                  <span
                    className={cx(styles.bar, styles.applicationBar)}
                    style={{ height: percent(period.applications[index]) }}
                  />
                  <span
                    className={cx(styles.bar, styles.shortlistBar)}
                    style={{ height: percent(period.shortlisted[index]) }}
                  />
                </>
              )}
            </div>
          ))}
          {view === 'line' && <LineChart applications={period.applications} shortlisted={period.shortlisted} />}
        </div>
      </div>
      <div className={cx(styles.labels, view === 'line' && styles.labelsLine)} aria-hidden="true">
        {MOMENTUM_DAYS.map((day) => (
          <span key={day} className={styles.label}>
            {day}
          </span>
        ))}
      </div>
    </section>
  )
}
