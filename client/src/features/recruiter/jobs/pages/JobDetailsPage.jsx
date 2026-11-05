import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Lightbulb, Settings2, X } from 'lucide-react'
import PageTitle from '@/components/common/PageTitle.jsx'
import { Button, Icon, IconButton, Skeleton } from '@/components/ui'
import { useJobText } from '@/lib/jobText.js'
import { useGetRecruiterJobQuery } from '../api.js'
import JobApplicantsList from '../components/JobApplicantsList.jsx'
import JobNotFound from '../components/JobNotFound.jsx'
import JobPosting, { JobPostingSkeleton } from '../components/JobPosting.jsx'
import JobTalentList from '../components/JobTalentList.jsx'
import styles from './JobDetailsPage.module.css'
import { useMarkSeen } from '@/features/notifications/api.js'

/** One recruiter job (A: recruiter A14): the posting, its applicants, the relevant talent (M-051 fallback) and links into discovery. */
export default function JobDetailsPage() {
  const { t } = useTranslation()
  const { jobId } = useParams()
  // P11b-Q10: opening this item marks its notifications read.
  useMarkSeen('job', jobId)
  const jobText = useJobText()
  const { data: job, error, isLoading } = useGetRecruiterJobQuery(jobId)
  const location = useLocation()
  const navigate = useNavigate()
  // One-off message key from Create / Edit job, cleared from history so a refresh does not repeat it.
  const [notice, setNotice] = useState(location.state?.notice)

  useEffect(() => {
    if (location.state?.notice) navigate(location.pathname, { replace: true, state: null })
  }, [location.pathname, location.state, navigate])

  if (error) return <JobNotFound />
  if (!job && !isLoading) return null

  // While the job loads, the page keeps its layout with placeholders for the job's own text.
  const meta = job && [job.company.displayName, jobText.place(job), job.workPreference && t(`enums:workPreference.${job.workPreference}`), jobText.salary(job)].filter(Boolean).join(' · ')

  return (
    <>
      <Link to="/recruiter/jobs" className={styles.back}>
        <Icon as={ArrowLeft} size={13} />
        {t('jobs:details.back')}
      </Link>

      {notice && (
        <div className={styles.notice} role="status">
          <span>{t(`jobs:notices.${notice}`)}</span>
          <IconButton icon={X} label={t('jobs:details.dismiss')} iconSize={14} onClick={() => setNotice(undefined)} />
        </div>
      )}

      <PageTitle
        className={styles.title}
        eyebrow={!job ? <Skeleton width={64} /> : job.restricted ? t('jobs:table.restricted') : t(`enums:jobStatus.${job.status}`)}
        title={job?.title ?? <Skeleton width="min(320px, 80vw)" height={28} />}
        description={meta ?? <Skeleton width="min(360px, 80vw)" />}
        actions={
          <div className={styles.actions}>
            <Button as={Link} to={`/recruiter/jobs/${jobId}/edit`} variant="secondary" className={styles.edit} leftIcon={<Icon as={Settings2} size={14} />}>
              {t('jobs:details.edit')}
            </Button>
          </div>
        }
      />
      {job?.restricted && <p className={styles.restricted}>{t('jobs:details.restricted', { reason: job.restricted.reason })}</p>}

      <div className={styles.layout}>
        <section className={styles.card} aria-labelledby="brief-title">
          <h2 className={styles.cardTitle} id="brief-title">
            {t('jobs:details.brief')}
          </h2>
          {job ? <JobPosting job={job} /> : <JobPostingSkeleton />}
          <JobApplicantsList jobId={jobId} />
          <JobTalentList jobId={jobId} />
        </section>

        <div className={styles.aside}>
          <section className={styles.activity} aria-labelledby="activity-title">
            <h2 className={styles.cardTitle} id="activity-title">
              {t('jobs:details.activity')}
            </h2>
            <p className={styles.activityText}>{job ? t('jobs:details.relevant', { count: job.relevantCount }) : <Skeleton width={180} />}</p>
            <div className={styles.buttons}>
              <Button as={Link} to={`/recruiter/find-candidates?jobId=${jobId}`} fullWidth rightIcon={<Icon as={ArrowRight} size={13} />}>
                {t('jobs:details.discover')}
              </Button>
              <Button as={Link} to={`/recruiter/applications?jobId=${jobId}`} variant="secondary" fullWidth className={styles.outlined}>
                {t('jobs:details.applications')}
              </Button>
            </div>
          </section>

          <aside className={`${styles.tip} sticky-side`}>
            <Icon as={Lightbulb} size={16} />
            <p>{t('jobs:details.tip')}</p>
          </aside>
        </div>
      </div>
    </>
  )
}
