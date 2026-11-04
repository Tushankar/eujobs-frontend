import { useTranslation } from 'react-i18next'
import { ChevronDown, TrendingUp } from 'lucide-react'
import { Icon, Panel } from '@/components/ui'
import SectionTitle from '@/components/common/SectionTitle.jsx'
import { PERIODS, useActivity } from '@/features/admin/overview/useActivity.js'
import { cx } from '@/utils/cx.js'
import { BarChart, LineChart } from './ActivityCharts.jsx'
import styles from './ActivityCard.module.css'

/** Platform activity card (M-170, M-171): bar / line switch, period select and the real counts for the period. */
export default function ActivityCard({ view, period, country, onViewChange, onPeriodChange }) {
  const { t } = useTranslation(['adminOverview', 'enums'])
  const activity = useActivity('analytics', period, country)
  const Chart = view === 'line' ? LineChart : BarChart
  return (
    <Panel padding={24} className={cx(styles.card, view === 'line' && styles.lineView)}>
      <SectionTitle title={t('chart.title')} description={t('chart.description')}>
        <div className={styles.controls}>
          <div className={styles.toggle} role="group" aria-label={t('chart.view')}>
            <button
              type="button"
              className={cx(styles.toggleButton, view === 'bar' && styles.active)}
              aria-pressed={view === 'bar'}
              aria-label={t('chart.bars')}
              title={t('chart.bars')}
              onClick={() => onViewChange('bar')}
            >
              <span className={styles.barGlyph} aria-hidden="true" />
            </button>
            <button
              type="button"
              className={cx(styles.toggleButton, view === 'line' && styles.active)}
              aria-pressed={view === 'line'}
              aria-label={t('chart.line')}
              title={t('chart.line')}
              onClick={() => onViewChange('line')}
            >
              <Icon as={TrendingUp} size={12} />
            </button>
          </div>
          <label className={styles.select}>
            <span className="sr-only">{t('chart.period')}</span>
            <select name="period" value={period} onChange={(event) => onPeriodChange(event.target.value)}>
              {PERIODS.map((option) => (
                <option key={option} value={option}>
                  {t(`enums:reportPeriod.${option}`)}
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
          {t('chart.registrations')}
        </li>
        <li>
          <span className={cx(styles.swatch, styles.applications)} />
          {t('chart.applications')}
        </li>
      </ul>
      <div className={styles.chart} data-activity-chart={activity ? period : undefined}>
        {activity && <Chart {...activity} />}
      </div>
    </Panel>
  )
}
