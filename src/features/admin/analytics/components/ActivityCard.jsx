import { ChevronDown, TrendingUp } from 'lucide-react'
import { Icon, Panel } from '@/components/ui'
import SectionTitle from '@/components/common/SectionTitle.jsx'
import { cx } from '@/utils/cx.js'
import { ACTIVITY_BY_RANGE, DATE_RANGES } from '../data/analytics.js'
import { BarChart, LineChart } from './ActivityCharts.jsx'
import styles from './ActivityCard.module.css'

/** Platform activity card: bar / line view switch, date-range select and the chart for the chosen range. */
export default function ActivityCard({ view, range, onViewChange, onRangeChange }) {
  const activity = ACTIVITY_BY_RANGE[range]
  const Chart = view === 'line' ? LineChart : BarChart

  return (
    <Panel padding={24} className={styles.card}>
      <SectionTitle title="Platform activity" description="Illustrative registrations and applications">
        <div className={styles.controls}>
          <div className={styles.toggle} role="group" aria-label="Chart type">
            <button
              type="button"
              className={cx(styles.toggleButton, view === 'bar' && styles.active)}
              aria-pressed={view === 'bar'}
              aria-label="Bar chart"
              title="Bar chart"
              onClick={() => onViewChange('bar')}
            >
              <span className={styles.barGlyph} aria-hidden="true" />
            </button>
            <button
              type="button"
              className={cx(styles.toggleButton, view === 'line' && styles.active)}
              aria-pressed={view === 'line'}
              aria-label="Line chart"
              title="Line chart"
              onClick={() => onViewChange('line')}
            >
              <Icon as={TrendingUp} size={12} />
            </button>
          </div>
          <label className={styles.select}>
            <span className="sr-only">Date range</span>
            <select value={range} onChange={(event) => onRangeChange(event.target.value)}>
              {DATE_RANGES.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
            <Icon as={ChevronDown} size={10} strokeWidth={2.2} className={styles.chevron} />
          </label>
        </div>
      </SectionTitle>

      <ul className={styles.legend}>
        <li>
          <span className={cx(styles.swatch, styles.registrations)} />
          Registrations
        </li>
        <li>
          <span className={cx(styles.swatch, styles.applications)} />
          Applications
        </li>
      </ul>

      <div className={styles.chart}>
        <Chart {...activity} />
      </div>
    </Panel>
  )
}
