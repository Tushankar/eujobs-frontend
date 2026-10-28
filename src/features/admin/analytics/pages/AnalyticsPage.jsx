import { useSearchParams } from 'react-router-dom'
import PageTitle from '@/components/common/PageTitle.jsx'
import StatCard from '@/components/common/StatCard.jsx'
import ActivityCard from '../components/ActivityCard.jsx'
import { DemandedSkills, MatchingQuality } from '../components/InsightCards.jsx'
import { ACTIVITY_BY_RANGE, ANALYTICS_STATS } from '../data/analytics.js'
import styles from './AnalyticsPage.module.css'

/**
 * Analytics. The bar/line switch and the date range live in the URL (?view=line&range=last-week),
 * so the line-graph Figma frame is this page with view=line.
 */
export default function AnalyticsPage() {
  const [params, setParams] = useSearchParams()
  const view = params.get('view') === 'line' ? 'line' : 'bar'
  const range = params.get('range') in ACTIVITY_BY_RANGE ? params.get('range') : 'this-week'

  function update(key, value) {
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        next.set(key, value)
        return next
      },
      { replace: true },
    )
  }

  return (
    <>
      <PageTitle
        title="Measure what moves people forward."
        description="A clear view of marketplace engagement, with enough context to act responsibly."
      />

      <div className={styles.stats}>
        {ANALYTICS_STATS.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </div>

      <div className={styles.split}>
        <ActivityCard
          view={view}
          range={range}
          onViewChange={(next) => update('view', next)}
          onRangeChange={(next) => update('range', next)}
        />
        <DemandedSkills />
      </div>

      <div className={styles.quality}>
        <MatchingQuality />
      </div>
    </>
  )
}
