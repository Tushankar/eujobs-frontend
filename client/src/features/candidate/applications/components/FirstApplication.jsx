import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { Button, Icon, SkeletonRegion } from '@/components/ui'
import GetStartedCard from '@/components/common/GetStartedCard.jsx'
import { useGetRecommendedJobsQuery, useSaveToggle, useSearchJobsQuery } from '@/features/candidate/jobs/api.js'
import JobCard, { JobCardSkeleton } from '@/features/candidate/jobs/components/JobCard.jsx'
import styles from './FirstApplication.module.css'

const SHOWN = 3

/**
 * Applications with none sent yet: the get-started card, then live jobs to apply to (the profile's matches, or the
 * newest roles in the market when nothing matches).
 */
export default function FirstApplication() {
  const { t } = useTranslation()
  const toggleSave = useSaveToggle()
  const { data: recommended, isLoading: recommendedLoading } = useGetRecommendedJobsQuery()
  const newest = recommended?.items.length === 0
  const { data: recent, isLoading: recentLoading } = useSearchJobsQuery({ sort: 'newest' }, { skip: !newest })
  const jobs = (newest ? recent : recommended)?.items.slice(0, SHOWN)
  const loading = recommendedLoading || recentLoading

  return (
    <>
      <GetStartedCard
        id="applications-start-title"
        className={styles.start}
        title={t('applications:start.title')}
        text={t('applications:start.text')}
        steps={t('applications:start.steps', { returnObjects: true })}
        action={
          <Button as={Link} to="/candidate/jobs">
            {t('applications:list.findJobs')}
          </Button>
        }
      />

      {(loading || jobs?.length > 0) && (
        <section className={styles.suggestions} aria-labelledby="applications-suggestions">
          <div className={styles.head}>
            <div>
              <h2 id="applications-suggestions" className={styles.title}>
                {t('applications:start.suggestions')}
              </h2>
              <p className={styles.text}>{t(newest ? 'applications:start.recentText' : 'applications:start.matchedText')}</p>
            </div>
            <Link to="/candidate/jobs" className={styles.viewAll}>
              {t('applications:start.viewAll')}
              <Icon as={ArrowRight} size={12} />
            </Link>
          </div>
          {loading ? (
            <SkeletonRegion className={styles.jobs}>
              {Array.from({ length: SHOWN }, (_, index) => (
                <JobCardSkeleton key={index} />
              ))}
            </SkeletonRegion>
          ) : (
            <div className={styles.jobs}>
              {jobs.map((job) => (
                <JobCard key={job.id} job={job} onToggleSave={toggleSave} />
              ))}
            </div>
          )}
        </section>
      )}
    </>
  )
}
