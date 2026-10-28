import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, Bookmark, BriefcaseBusiness, Eye, Search, ShieldCheck, SlidersHorizontal, Sparkle, Sun } from 'lucide-react'
import { Button, Icon } from '@/components/ui'
import EmptyState from '@/components/common/EmptyState.jsx'
import SegmentedTabs from '@/components/common/SegmentedTabs.jsx'
import StatCard from '@/components/common/StatCard.jsx'
import aiGlyph from '@/assets/icons/ai-glyph-blue.svg'
import aiNavGlyph from '@/assets/icons/ai-nav.svg'
import JobCard from '@/features/candidate/jobs/components/JobCard.jsx'
import { JOBS } from '@/features/candidate/jobs/data/jobs.js'
import { jobPath } from '@/features/candidate/jobs/data/jobUtils.js'
import { useApplications } from '@/features/candidate/jobs/hooks/useApplications.js'
import { useSavedJobs } from '@/features/candidate/jobs/hooks/useSavedJobs.js'
import ApplicationActivityCard from '../components/ApplicationActivityCard.jsx'
import InsightCard from '../components/InsightCard.jsx'
import ProfileStrengthCard from '../components/ProfileStrengthCard.jsx'
import VerificationCard from '../components/VerificationCard.jsx'
import styles from './OverviewPage.module.css'

const TABS = [
  { id: 'for-you', label: 'For you', iconSrc: aiGlyph },
  { id: 'recent', label: 'Recently added' },
  { id: 'saved', label: 'Saved' },
]

const SHOWN = 3

/** Candidate Overview: greeting, KPI cards, recommended jobs (For you / Recently added / Saved) and the profile side rail. */
export default function OverviewPage() {
  const [tab, setTab] = useState('for-you')
  const { savedIds, isSaved, toggleSaved } = useSavedJobs()
  const { activeCount, hasApplied, applyTo } = useApplications()

  const jobs = useMemo(() => {
    if (tab === 'recent') return [...JOBS].sort((a, b) => a.postedHoursAgo - b.postedHoursAgo).slice(0, SHOWN)
    if (tab === 'saved') return JOBS.filter((job) => savedIds.includes(job.id)).slice(0, SHOWN)
    return JOBS.slice(0, SHOWN)
  }, [tab, savedIds])

  return (
    <div>
      <div className={styles.dateRow}>
        <p className={styles.date}>
          <Icon as={Sparkle} size={11} className={styles.dateStar} fill="currentColor" />
          Wednesday, September 30, 2026
        </p>
        <span className={styles.upToDate}>
          <span className={styles.upToDateDot} aria-hidden="true" />
          Your matches are up to date
        </span>
      </div>

      <section className={styles.hero}>
        <div>
          <p className={styles.greeting}>
            Good morning, Alex <Icon as={Sun} size={13} />
          </p>
          <h1 className={styles.title}>
            Your next chapter.
            <br />
            <span className={styles.titleMuted}>Matched to you.</span>
          </h1>
          <p className={styles.lead}>Less searching. More possibilities. Find work that fits who you are.</p>
        </div>
        <Button as={Link} to="/candidate/jobs" leftIcon={<Icon as={Search} size={14} />} rightIcon={<Icon as={ArrowUpRight} size={13} />}>
          Explore jobs
        </Button>
      </section>

      <div className={styles.stats}>
        <Link to="/candidate/jobs" className={styles.statLink}>
          <StatCard label="Recommended jobs" value="6" delta="+6 this week" caption="Curated around your experience" iconSrc={aiNavGlyph} />
        </Link>
        <Link to="/candidate/applications" className={styles.statLink}>
          <StatCard label="Active applications" value={activeCount} caption="Your next step is in progress" icon={BriefcaseBusiness} />
        </Link>
        <Link to="/candidate/jobs" className={styles.statLink}>
          <StatCard label="Saved opportunities" value={savedIds.length} caption="Good things worth coming back to" icon={Bookmark} />
        </Link>
        <Link to="/candidate/profile" className={styles.statLink}>
          <StatCard label="Profile views" value="18" delta="↑ 12%" caption="From verified companies" icon={Eye} />
        </Link>
      </div>

      <div className={styles.columns}>
        <section className={styles.main}>
          <div className={styles.sectionHead}>
            <div>
              <h2 className={styles.sectionTitle}>Opportunities for you</h2>
              <p className={styles.sectionText}>Thoughtfully matched. Not just another list of jobs.</p>
            </div>
            <Link to="/candidate/jobs" className={styles.viewAll}>
              View all
              <Icon as={ArrowRight} size={12} />
            </Link>
          </div>

          <div className={styles.tabsRow}>
            <SegmentedTabs label="Opportunity lists" tabs={TABS} value={tab} onChange={setTab} />
            <Link to="/candidate/profile" className={styles.preferences}>
              <Icon as={SlidersHorizontal} size={12} />
              Preferences
            </Link>
          </div>

          <div className={styles.list} role="tabpanel">
            {jobs.length === 0 ? (
              <EmptyState
                icon={Bookmark}
                title="No saved jobs yet"
                description="Tap the bookmark on any opportunity to keep it here."
                action={
                  <Button as={Link} to="/candidate/jobs" variant="secondary">
                    Browse jobs
                  </Button>
                }
              />
            ) : (
              jobs.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  detailsPath={jobPath(job.id)}
                  showAiMatch
                  saved={isSaved(job.id)}
                  applied={hasApplied(job.id)}
                  onToggleSave={toggleSaved}
                  onApply={applyTo}
                />
              ))
            )}
          </div>
          <p className={styles.caption}>
            <Icon as={ShieldCheck} size={13} />
            AI-powered matching. Your decision, always.
          </p>
        </section>

        <aside className={styles.rail} aria-label="Profile progress">
          <ProfileStrengthCard />
          <VerificationCard />
          <InsightCard />
          <ApplicationActivityCard />
        </aside>
      </div>
    </div>
  )
}
