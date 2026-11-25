import { useTranslation } from 'react-i18next'
import { ChevronDown, TrendingUp } from 'lucide-react'
import { Icon, Panel } from '@/components/ui'
import SectionTitle from '@/components/common/SectionTitle.jsx'
import { PERIODS, useActivity } from '@/features/admin/overview/useActivity.js'
import { useFormat } from '@/lib/preferences.js'
import { cx } from '@/utils/cx.js'
import { ActivityChart, ChartSkeleton } from './ActivityCharts.jsx'
import styles from './ActivityCard.module.css'

const SERIES = ['registrations', 'applications']

/**
 * Platform activity card (M-170, M-171) on Overview and Analytics (`source`): bar / line switch, period select, the
 * period's totals in the legend and the real counts per day or week.
 */
export default function ActivityCard({ source = 'analytics', titleId, view, period, country, onViewChange, onPeriodChange }) {
  const { t } = useTranslation(['adminOverview', 'enums'])
  const format = useFormat()
  const { data: activity, loading, busy } = useActivity(source, period, country)
  const summary =
    activity &&
    t('chart.summary', {
      period: t(`enums:reportPeriod.${period}`),
      items: activity.labels.map((label, index) => t('chart.point', { label, registrations: activity.registrations[index], applications: activity.applications[index] })).join('; '),
    })
  const total = (key) => activity?.[key].reduce((sum, value) => sum + value, 0)
  return (
    <Panel padding={24} className={styles.card} aria-labelledby={titleId}>
      <SectionTitle id={titleId} title={t('chart.title')} description={t('chart.description')}>
        <div className={styles.controls}>
          <div className={styles.toggle} role="group" aria-label={t('chart.view')}>
            {[
              ['bar', <span key="glyph" className={styles.barGlyph} aria-hidden="true" />, t('chart.bars')],
              ['line', <Icon key="glyph" as={TrendingUp} size={14} />, t('chart.line')],
            ].map(([value, glyph, label]) => (
              <button key={value} type="button" className={cx(styles.toggleButton, view === value && styles.active)} aria-pressed={view === value} aria-label={label} title={label} onClick={() => onViewChange(value)}>
                {glyph}
              </button>
            ))}
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
            <Icon as={ChevronDown} size={14} className={styles.chevron} />
          </label>
        </div>
      </SectionTitle>
      <ul className={styles.legend}>
        {SERIES.map((key) => (
          <li key={key} className={styles[key]}>
            <span className={cx(styles.swatch, view === 'line' && styles.lineSwatch)} />
            {t(`chart.${key}`)}
            {activity && <strong>{format.number(total(key))}</strong>}
          </li>
        ))}
      </ul>
      {loading ? (
        <ChartSkeleton />
      ) : (
        <div className={cx(styles.chart, busy && styles.busy)} role="img" aria-label={summary ?? ''} aria-busy={busy || undefined} data-activity-chart={activity ? period : undefined}>
          {activity && <ActivityChart view={view} {...activity} />}
        </div>
      )}
    </Panel>
  )
}
