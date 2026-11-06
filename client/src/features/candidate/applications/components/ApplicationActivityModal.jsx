import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Check, X } from 'lucide-react'
import { Button, CompanyLogo, Icon, Modal } from '@/components/ui'
import { MessageCompanyButton } from '@/features/messages/components/StartConversation.jsx'
import { useJobText } from '@/lib/jobText.js'
import { useFormat } from '@/lib/preferences.js'
import { cx } from '@/utils/cx.js'
import { canWithdraw } from '../status.js'
import styles from './ApplicationActivityModal.module.css'

const PATH = ['applied', 'under_review', 'interview', 'offer', 'hired']

/**
 * The fixed stepper: every step of the path, each reached one dated by its latest move (a back-and-forth between
 * stages collapses). A withdrawn or not-selected application ends after the furthest step it reached.
 */
function buildSteps(history, status) {
  const lastAt = (step) => history.findLast((entry) => entry.status === step)?.at
  const ended = status === 'withdrawn' || status === 'not_selected'
  const reached = ended ? Math.max(0, ...history.map((entry) => PATH.indexOf(entry.status))) : PATH.indexOf(status)
  const steps = (ended ? PATH.slice(0, reached + 1) : PATH).map((step, index) => ({
    status: step,
    state: index < reached || (ended && index === reached) ? 'done' : index === reached ? 'current' : 'upcoming',
    at: index <= reached ? lastAt(step) : undefined,
  }))
  if (ended) steps.push({ status, state: 'ended', at: lastAt(status) })
  return steps
}

/**
 * "View activity" (M-075): the dated status steps, the next step, the CV sent and the cover note, with a message to
 * the company (M-084), withdraw (M-074) or, for a withdrawn application to a job still open, Apply again.
 */
export default function ApplicationActivityModal({ application, canReapply, onClose, onWithdraw, onReapply, onMessage }) {
  const { t } = useTranslation()
  const format = useFormat()
  const jobText = useJobText()
  if (!application) return null
  const { job, history, cv } = application
  const steps = buildSteps(history, application.status)

  return (
    <Modal
      open
      onClose={onClose}
      title={t('applications:activity.title')}
      description={`${job.title} · ${job.company.displayName}`}
      width={460}
      footer={
        <>
          <Button as={Link} to={`/candidate/jobs/${job.id}`} variant="secondary" onClick={onClose}>
            {t('applications:activity.viewJob')}
          </Button>
          <MessageCompanyButton job={job} canStart={application.status !== 'withdrawn'} onStart={() => onMessage(application)} />
          {canWithdraw(application.status) && (
            <Button variant="danger" onClick={() => onWithdraw(application)}>
              {t('applications:activity.withdraw')}
            </Button>
          )}
          {canReapply && <Button onClick={() => onReapply(application)}>{t('applications:activity.applyAgain')}</Button>}
        </>
      }
    >
      <div className={styles.job}>
        <CompanyLogo name={job.company.displayName} id={job.company.id} src={job.company.logoUrl ?? undefined} size={36} />
        <div>
          <p className={styles.jobTitle}>{job.title}</p>
          <p className={styles.jobMeta}>
            {[job.company.displayName, jobText.place(job), t('applications:activity.appliedOn', { date: format.date(application.appliedAt) })].filter(Boolean).join(' · ')}
          </p>
        </div>
      </div>

      <ol className={styles.steps} aria-label={t('applications:activity.progress')} data-history>
        {steps.map((step) => (
          <li
            key={step.status}
            className={cx(styles.step, styles[step.state])}
            aria-current={step.state === 'current' || step.state === 'ended' ? 'step' : undefined}
            data-step={step.state === 'upcoming' ? undefined : step.status}
          >
            <span className={styles.marker}>
              {step.state === 'done' && <Icon as={Check} size={13} strokeWidth={2.6} />}
              {step.state === 'ended' && <Icon as={X} size={13} strokeWidth={2.6} />}
            </span>
            <span className={styles.stepLabel}>{t(`enums:applicationStatus.${step.status}`)}</span>
            {step.state === 'current' && <span className={styles.currentTag}>{t('applications:activity.current')}</span>}
            {step.at && (
              <time className={styles.date} dateTime={step.at}>
                {format.date(step.at)}
              </time>
            )}
          </li>
        ))}
      </ol>

      <dl className={styles.details}>
        <div>
          <dt>{t('applications:activity.nextStep')}</dt>
          <dd>{t(`applications:nextStep.${application.status}`)}</dd>
        </div>
        {cv && (
          <div>
            <dt>{t('applications:activity.cv')}</dt>
            <dd>{t(cv.removed ? 'applications:activity.cvRemoved' : 'applications:activity.cvVersion', { number: cv.number, name: cv.originalName })}</dd>
          </div>
        )}
        {application.interviews?.length > 0 && (
          // §3.23: the application's interviews, each opening its card in the thread.
          <div>
            <dt>{t('applications:activity.interviews')}</dt>
            <dd>
              <ul className={styles.interviews} data-application-interviews>
                {application.interviews.map((interview) => (
                  <li key={interview.id}>
                    <Link to={`/candidate/messages/${interview.conversationId}?card=${interview.id}`} onClick={onClose}>
                      {t(`enums:interviewStatus.${interview.status}`)}
                      {interview.startAt && <> · {format.dateTime(interview.startAt)}</>} · {t(`enums:interviewMode.${interview.mode}`)}
                    </Link>
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        )}
        {application.coverNote && (
          <div>
            <dt>{t('applications:activity.coverNote')}</dt>
            <dd className={styles.note}>{application.coverNote}</dd>
          </div>
        )}
      </dl>
      {!job.accepting && <p className={styles.closed}>{t('applications:activity.notAccepting')}</p>}
    </Modal>
  )
}
