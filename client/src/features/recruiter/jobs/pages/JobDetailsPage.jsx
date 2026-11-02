import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Settings2, X } from 'lucide-react'
import PageTitle from '@/components/common/PageTitle.jsx'
import { Button, Icon, IconButton } from '@/components/ui'
import aiSparkle from '@/assets/icons/ai-sparkle-blue.svg'
import { useJobText } from '@/lib/jobText.js'
import { useGetRecruiterJobQuery } from '../api.js'
import JobApplicantsList from '../components/JobApplicantsList.jsx'
import JobNotFound from '../components/JobNotFound.jsx'
import JobPosting from '../components/JobPosting.jsx'
import JobTalentList from '../components/JobTalentList.jsx'
import styles from './JobDetailsPage.module.css'

/** One recruiter job (A: recruiter A14): the posting, its applicants, the relevant talent (M-051 fallback) and links into discovery. */
export default function JobDetailsPage() {
  const { t } = useTranslation()
  const { jobId } = useParams()
  const jobText = useJobText()
  const { data: job, error } = useGetRecruiterJobQuery(jobId)
  const location = useLocation()
  const navigate = useNavigate()
  // One-off message key from Create / Edit job, cleared from history so a refresh does not repeat it.
  const [notice, setNotice] = useState(location.state?.notice)

  useEffect(() => {
    if (location.state?.notice) navigate(location.pathname, { replace: true, state: null })
  }, [location.pathname, location.state, navigate])

  if (error) return <JobNotFound />
  if (!job) return null

  const meta = [job.company.displayName, jobText.place(job), job.workPreference && t(`enums:workPreference.${job.workPreference}`), jobText.salary(job)].filter(Boolean).join(' · ')

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
        eyebrow={job.restricted ? t('jobs:table.restricted') : t(`enums:jobStatus.${job.status}`)}
        title={job.title}
        description={meta}
        actions={
          <div className={styles.actions}>
            <Button as={Link} to={`/recruiter/jobs/${job.id}/edit`} variant="secondary" className={styles.edit} leftIcon={<Icon as={Settings2} size={14} />}>
              {t('jobs:details.edit')}
            </Button>
          </div>
        }
      />
      {job.restricted && <p className={styles.restricted}>{t('jobs:details.restricted', { reason: job.restricted.reason })}</p>}

      <div className={styles.layout}>
        <section className={styles.card} aria-labelledby="brief-title">
          <h2 className={styles.cardTitle} id="brief-title">
            {t('jobs:details.brief')}
          </h2>
          <JobPosting job={job} />
          <JobApplicantsList jobId={job.id} />
          <JobTalentList jobId={job.id} />
        </section>

        <div className={styles.aside}>
          <section className={styles.activity} aria-labelledby="activity-title">
            <h2 className={styles.cardTitle} id="activity-title">
              {t('jobs:details.activity')}
            </h2>
            <p className={styles.activityText}>{t('jobs:details.relevant', { count: job.relevantCount })}</p>
            <div className={styles.buttons}>
              <Button as={Link} to={`/recruiter/find-candidates?jobId=${job.id}`} fullWidth rightIcon={<Icon as={ArrowRight} size={13} />}>
                {t('jobs:details.discover')}
              </Button>
              <Button as={Link} to={`/recruiter/applications?jobId=${job.id}`} variant="secondary" fullWidth className={styles.outlined}>
                {t('jobs:details.applications')}
              </Button>
            </div>
          </section>

          <aside className={styles.tip}>
            <img src={aiSparkle} alt="" width={14} height={14} />
            <p>{t('jobs:details.tip')}</p>
          </aside>
        </div>
      </div>
    </>
  )
}
