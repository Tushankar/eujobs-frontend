import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Check } from 'lucide-react'
import { Button, CompanyLogo, Icon, Modal } from '@/components/ui'
import { MessageCompanyButton } from '@/features/messages/components/StartConversation.jsx'
import { useJobText } from '@/lib/jobText.js'
import { useFormat } from '@/lib/preferences.js'
import { canWithdraw } from '../status.js'
import styles from './ApplicationActivityModal.module.css'

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
  const current = history.length - 1

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
        {history.map((step, index) => (
          <li key={`${step.status}-${step.at}`} className={`${styles.step} ${styles.done}`} aria-current={index === current ? 'step' : undefined} data-step={step.status}>
            <span className={styles.marker}>
              <Icon as={Check} size={11} strokeWidth={2.4} />
            </span>
            <span className={styles.stepLabel}>{t(`enums:applicationStatus.${step.status}`)}</span>
            <time className={styles.date} dateTime={step.at}>
              {format.date(step.at)}
            </time>
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
