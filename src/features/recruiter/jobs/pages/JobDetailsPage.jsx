import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Settings2, X } from 'lucide-react'
import PageTitle from '@/components/common/PageTitle.jsx'
import { Button, Icon, IconButton } from '@/components/ui'
import aiSparkle from '@/assets/icons/ai-sparkle-blue.svg'
import AiJobSummary from '../components/AiJobSummary.jsx'
import JobNotFound from '../components/JobNotFound.jsx'
import JobPosting from '../components/JobPosting.jsx'
import JobTalentList from '../components/JobTalentList.jsx'
import { JOB_STATUSES } from '../data/jobs.js'
import { jobMetaLine } from '../data/jobFields.js'
import { useJobs } from '../hooks/useJobs.js'
import styles from './JobDetailsPage.module.css'

export default function JobDetailsPage() {
  const { jobId } = useParams()
  const { getJob } = useJobs()
  const location = useLocation()
  const navigate = useNavigate()
  // One-off message from Create / Edit job (e.g. "Job published"), cleared from history so a refresh does not repeat it.
  const [notice, setNotice] = useState(location.state?.notice)
  const job = getJob(jobId)

  useEffect(() => {
    if (location.state?.notice) navigate(location.pathname, { replace: true, state: null })
  }, [location.pathname, location.state, navigate])

  if (!job) return <JobNotFound />

  return (
    <>
      <Link to="/recruiter/jobs" className={styles.back}>
        <Icon as={ArrowLeft} size={13} />
        Back to jobs
      </Link>

      {notice && (
        <div className={styles.notice} role="status">
          <span>{notice}</span>
          <IconButton icon={X} label="Dismiss message" iconSize={14} onClick={() => setNotice(undefined)} />
        </div>
      )}

      <PageTitle
        className={styles.title}
        eyebrow={JOB_STATUSES[job.status].label}
        title={job.title}
        description={jobMetaLine(job)}
        actions={
          <div className={styles.actions}>
            <AiJobSummary job={job} />
            <Button
              as={Link}
              to={`/recruiter/jobs/${job.id}/edit`}
              variant="secondary"
              className={styles.edit}
              leftIcon={<Icon as={Settings2} size={14} />}
            >
              Edit role
            </Button>
          </div>
        }
      />

      <div className={styles.layout}>
        <section className={styles.card} aria-labelledby="brief-title">
          <h2 className={styles.cardTitle} id="brief-title">
            The brief
          </h2>
          <JobPosting job={job} />
          <JobTalentList relevant={job.relevant} />
        </section>

        <div className={styles.aside}>
          <section className={styles.activity} aria-labelledby="activity-title">
            <h2 className={styles.cardTitle} id="activity-title">
              Role activity
            </h2>
            <p className={styles.activityText}>
              {job.applications ?? 0} local applications · {job.relevant} profiles with relevant listed skills
            </p>
            <div className={styles.buttons}>
              <Button
                as={Link}
                to="/recruiter/find-candidates"
                fullWidth
                rightIcon={<Icon as={ArrowRight} size={13} />}
              >
                Discover candidates
              </Button>
              <Button as={Link} to="/recruiter/applications" variant="secondary" fullWidth className={styles.outlined}>
                Review applications
              </Button>
            </div>
          </section>

          <aside className={styles.tip}>
            <img src={aiSparkle} alt="" width={14} height={14} />
            <p>
              A clear brief makes matching more useful. Review requirements regularly and keep mandatory criteria
              role-relevant.
            </p>
          </aside>
        </div>
      </div>
    </>
  )
}
