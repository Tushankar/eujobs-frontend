import { useTranslation } from 'react-i18next'
import { Clock, MessageSquareText, Sparkles } from 'lucide-react'
import { Avatar, Icon } from '@/components/ui'
import PillBadge from '@/components/common/PillBadge.jsx'
import ApplicationStageSelect from '@/features/recruiter/applications/components/ApplicationStageSelect.jsx'
import { useFormat } from '@/lib/preferences.js'
import { cx } from '@/utils/cx.js'
import styles from './ApplicantCard.module.css'

/**
 * Board card for one application (M-069): the candidate, the job, the skill overlap, the note count and the stage
 * select. Draggable; a click outside its controls opens the candidate panel (`onOpen`).
 */
export default function ApplicantCard({ application, stages, dragging, onDragStart, onDragEnd, onOpen }) {
  const { t } = useTranslation()
  const format = useFormat()
  const { candidate, job } = application
  const meta = [
    candidate.yearsExperience != null && t('applications:board.years', { count: candidate.yearsExperience }),
    candidate.workPreference && t(`enums:workPreference.${candidate.workPreference}`),
  ].filter(Boolean)

  return (
    <article
      className={cx(styles.card, dragging && styles.dragging)}
      data-application={application.id}
      draggable
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = 'move'
        event.dataTransfer.setData('text/plain', application.id)
        onDragStart(application.id)
      }}
      onDragEnd={onDragEnd}
      onClick={(event) => {
        if (!event.target.closest('button, a, select, input, [role="listbox"]')) onOpen(application.id)
      }}
    >
      <div className={styles.head}>
        <Avatar name={candidate.fullName} src={candidate.photoUrl ?? undefined} size={36} className={styles.avatar} />
        <button type="button" className={styles.name} onClick={() => onOpen(application.id)}>
          {candidate.fullName}
        </button>
      </div>
      <p className={styles.role}>{candidate.headline}</p>
      {meta.length > 0 && <p className={styles.meta}>{meta.join(' · ')}</p>}
      <div className={styles.badges}>
        <PillBadge tone="accent">
          <Icon as={Sparkles} size={10} />
          {t('applications:board.aligned', { count: candidate.alignedSkills })}
        </PillBadge>
        {application.noteCount > 0 && (
          <button type="button" className={styles.notes} onClick={() => onOpen(application.id)} aria-label={t('applications:board.notes', { count: application.noteCount })} data-note-count={application.noteCount}>
            <Icon as={MessageSquareText} size={12} />
            {application.noteCount}
          </button>
        )}
      </div>
      <div className={styles.footer}>
        <ApplicationStageSelect
          application={application}
          stages={stages}
          variant="card"
          candidateName={candidate.fullName}
          jobTitle={job.title}
          label={t('applications:board.move', { name: candidate.fullName })}
        />
        <p className={styles.activity}>
          <Icon as={Clock} size={10} />
          {t('applications:board.appliedFor', { job: job.title, date: format.date(application.appliedAt) })}
        </p>
      </div>
    </article>
  )
}
