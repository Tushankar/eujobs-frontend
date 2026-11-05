import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import { Avatar, Icon, Modal } from '@/components/ui'
import ApplicationStageSelect from '@/features/recruiter/applications/components/ApplicationStageSelect.jsx'
import CandidateNotes from '@/features/recruiter/find-candidates/components/CandidateNotes.jsx'
import { useFormat } from '@/lib/preferences.js'
import styles from './ApplicantPanel.module.css'

/**
 * The Hiring pipeline's candidate panel (owner decision 2026-11-05), the same from a board card and a funnel row:
 * the candidate and job, the stage select (move or Not selected, M-071), the company's dated notes (M-080) and every
 * dated stage step of this application, newest first.
 */
export default function ApplicantPanel({ application, stages, onClose }) {
  const { t } = useTranslation()
  const format = useFormat()
  // Keep showing the last application while the panel slides out.
  const [current, setCurrent] = useState(application)
  if (application && application !== current) setCurrent(application)
  if (!current) return null
  const { candidate, job } = current
  const steps = [...current.history].reverse()

  return (
    <Modal open={Boolean(application)} onClose={onClose} placement="right" width={480} divided title={candidate.fullName} description={candidate.headline || undefined}>
      <div className={styles.panel} data-applicant-panel={current.id}>
        <div className={styles.summary}>
          <Avatar name={candidate.fullName} src={candidate.photoUrl ?? undefined} size={48} />
          <div className={styles.summaryText}>
            <p className={styles.job}>{job.title}</p>
            <p className={styles.applied}>{t('applications:panel.applied', { date: format.dateTime(current.appliedAt) })}</p>
            <Link to={`/recruiter/find-candidates/${candidate.id}`} className={styles.profileLink}>
              {t('applications:panel.profile')}
              <Icon as={ArrowUpRight} size={13} />
            </Link>
          </div>
        </div>

        <section className={styles.section} aria-labelledby="panel-stage">
          <h3 id="panel-stage" className={styles.heading}>
            {t('applications:panel.stage')}
          </h3>
          <ApplicationStageSelect
            application={current}
            stages={stages}
            variant="panel"
            candidateName={candidate.fullName}
            jobTitle={job.title}
            label={t('applications:board.move', { name: candidate.fullName })}
          />
        </section>

        <section className={styles.section} aria-labelledby="panel-notes">
          <h3 id="panel-notes" className={styles.heading}>
            {t('applications:panel.notes')}
          </h3>
          <CandidateNotes candidateId={candidate.id} candidateName={candidate.fullName} applicationId={current.id} />
        </section>

        <section className={styles.section} aria-labelledby="panel-history">
          <h3 id="panel-history" className={styles.heading}>
            {t('applications:panel.history')}
          </h3>
          <ol className={styles.timeline}>
            {steps.map((step, index) => (
              <li key={`${step.at}-${index}`} className={styles.step}>
                <span className={styles.dot} aria-hidden="true" />
                <div>
                  <p className={styles.stepName}>
                    {['not_selected', 'withdrawn'].includes(step.status) ? t(`enums:applicationStatus.${step.status}`) : step.stageName}
                  </p>
                  <time className={styles.stepTime} dateTime={step.at}>
                    {format.dateTime(step.at)}
                  </time>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </Modal>
  )
}
