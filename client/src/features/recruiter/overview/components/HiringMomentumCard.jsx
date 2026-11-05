import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, TrendingUp } from 'lucide-react'
import { cx } from '@/utils/cx.js'
import { Icon, Skeleton, SkeletonRegion } from '@/components/ui'
import { useGetMomentumQuery } from '@/features/recruiter/applications/api.js'
import { browserTimeZone } from '@/lib/forms.js'
import { useFormat } from '@/lib/preferences.js'
import SectionHeading from './SectionHeading.jsx'
import styles from './HiringMomentumCard.module.css'

const PERIODS = ['this_week', 'last_week']
const DAYS = 7
// Placeholder bar heights (% of the plot) for the two series while the week loads.
const SKELETON_BARS = [
  [38, 18],
  [62, 30],
  [48, 24],
  [74, 36],
  [56, 22],
  [28, 12],
  [42, 20],
]

function ViewToggle({ view, onChange }) {
  const { t } = useTranslation()
  return (
    <div className={styles.toggle} role="group" aria-label={t('applications:overview.chartView')}>
      <button
        type="button"
        className={cx(styles.toggleButton, view === 'bars' && styles.toggleActive)}
        aria-pressed={view === 'bars'}
        aria-label={t('applications:overview.bars')}
        onClick={() => onChange('bars')}
      >
        <span className={styles.barsIcon} aria-hidden="true" />
      </button>
      <button
        type="button"
        className={cx(styles.toggleButton, view === 'line' && styles.toggleActive)}
        aria-pressed={view === 'line'}
        aria-label={t('applications:overview.line')}
        onClick={() => onChange('line')}
      >
        <Icon as={TrendingUp} size={12} />
      </button>
    </div>
  )
}

function LineChart({ applications, shortlisted, scale }) {
  const percent = (value) => `${(value / scale) * 100}%`
  const points = (values) =>
    values.map((value, index) => `${(index + 0.5) * 100},${175 - (value / scale) * 175}`).join(' ')
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
            style={{ left: `${((index + 0.5) / DAYS) * 100}%`, bottom: percent(value) }}
          />
        )),
      )}
    </div>
  )
}

/**
 * "Hiring momentum" (M-083, M-170): applications received and shortlist additions per day, Monday to Sunday of this
 * or last week in the browser's time zone, as bars or a line.
 */
export default function HiringMomentumCard() {
  const { t } = useTranslation()
  const format = useFormat()
  const [view, setView] = useState('bars')
  const [period, setPeriod] = useState(PERIODS[0])
  const { data, isLoading, isFetching, currentData } = useGetMomentumQuery({ tz: browserTimeZone(), period })
  // Another period is loading: the previous week stays, dimmed.
  const busy = isFetching && !currentData
  const days = data?.days ?? []
  const applications = days.map((day) => day.applications)
  const shortlisted = days.map((day) => day.shortlisted)
  // The scale fits the busiest day, with headroom so the tallest bar stays inside the plot.
  const scale = Math.max(4, Math.ceil(Math.max(0, ...applications, ...shortlisted) * 1.2))
  const percent = (value) => `${(value / scale) * 100}%`
  const summary = t('applications:overview.summary', { period: t(`applications:overview.periods.${period}`), applications: applications.join(', '), shortlisted: shortlisted.join(', ') })

  return (
    <section className={styles.card} aria-labelledby="momentum-title" data-card="momentum">
      <div className={styles.head}>
        <SectionHeading id="momentum-title" title={t('applications:overview.momentumTitle')} description={t('applications:overview.momentumDescription')} />
        <div className={styles.controls}>
          <ViewToggle view={view} onChange={setView} />
          <label className={styles.period}>
            <span className="sr-only">{t('applications:overview.period')}</span>
            <select value={period} name="period" onChange={(event) => setPeriod(event.target.value)} className={styles.select}>
              {PERIODS.map((item) => (
                <option key={item} value={item}>
                  {t(`applications:overview.periods.${item}`)}
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
          {t('applications:overview.applicationsSeries')}
        </li>
        <li className={styles.legendItem}>
          <span className={cx(styles.swatch, styles.shortlistSwatch)} />
          {t('applications:overview.shortlistedSeries')}
        </li>
      </ul>

      {isLoading ? (
        <SkeletonRegion>
          <div className={styles.chart}>
            <div className={styles.plot}>
              {SKELETON_BARS.map(([applicationHeight, shortlistHeight], index) => (
                <div key={index} className={styles.column}>
                  <Skeleton height={`${applicationHeight}%`} className={styles.skeletonBar} />
                  <Skeleton height={`${shortlistHeight}%`} className={styles.skeletonBar} />
                </div>
              ))}
            </div>
          </div>
          <div className={styles.labels}>
            {SKELETON_BARS.map((_, index) => (
              <span key={index} className={styles.label}>
                <Skeleton width={20} height={8} />
              </span>
            ))}
          </div>
        </SkeletonRegion>
      ) : (
        <>
        <div className={cx(styles.chart, busy && styles.busy)} role="img" aria-label={summary} aria-busy={busy || undefined} data-momentum={JSON.stringify(days)}>
          <div className={cx(styles.plot, view === 'line' && styles.plotLine)}>
            {days.map((day, index) => (
              <div key={day.date} className={styles.column}>
                {view === 'bars' && (
                  <>
                    <span className={cx(styles.bar, styles.applicationBar)} style={{ height: percent(applications[index]) }} />
                    <span className={cx(styles.bar, styles.shortlistBar)} style={{ height: percent(shortlisted[index]) }} />
                  </>
                )}
              </div>
            ))}
            {view === 'line' && days.length > 0 && <LineChart applications={applications} shortlisted={shortlisted} scale={scale} />}
          </div>
        </div>
        <div className={cx(styles.labels, view === 'line' && styles.labelsLine)} aria-hidden="true">
          {days.map((day) => (
            <span key={day.date} className={styles.label}>
              {format.date(day.date, { weekday: 'short' })}
            </span>
          ))}
        </div>
        </>
      )}
    </section>
  )
}
