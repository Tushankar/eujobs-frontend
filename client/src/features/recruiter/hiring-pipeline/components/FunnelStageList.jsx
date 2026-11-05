import { useTranslation } from 'react-i18next'
import { MessageSquareText } from 'lucide-react'
import { Avatar, Icon } from '@/components/ui'
import ApplicationStageSelect from '@/features/recruiter/applications/components/ApplicationStageSelect.jsx'
import { useFormat } from '@/lib/preferences.js'
import { cx } from '@/utils/cx.js'
import styles from './FunnelStageList.module.css'

/**
 * Who is in the funnel's selected stage now: one row per active application. A row drags onto any funnel stage,
 * moves with its stage menu (keyboard and touch), and opens the candidate panel on click.
 */
export default function FunnelStageList({ stage, applications, stages, move, onOpen }) {
  const { t } = useTranslation()
  const format = useFormat()

  return (
    <section className={styles.list} aria-labelledby="funnel-stage-title" data-funnel-list={stage.name}>
      <div className={styles.head}>
        <h3 id="funnel-stage-title" className={styles.title}>
          {stage.name}
        </h3>
        <p className={styles.count}>{t('applications:funnel.inStage', { count: applications.length })}</p>
      </div>
      {applications.length === 0 ? (
        <p className={styles.empty}>{t('applications:funnel.empty')}</p>
      ) : (
        <ul className={styles.rows}>
          {applications.map((application) => {
            const { candidate, job } = application
            const since = application.history.at(-1)?.at ?? application.appliedAt
            return (
              <li
                key={application.id}
                className={cx(styles.row, move.draggingId === application.id && styles.dragging)}
                data-application={application.id}
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = 'move'
                  event.dataTransfer.setData('text/plain', application.id)
                  move.start(application.id)
                }}
                onDragEnd={move.end}
                onClick={(event) => {
                  if (!event.target.closest('button, a, select, input, [role="listbox"]')) onOpen(application.id)
                }}
              >
                <Avatar name={candidate.fullName} src={candidate.photoUrl ?? undefined} size={40} />
                <div className={styles.who}>
                  <button type="button" className={styles.name} onClick={() => onOpen(application.id)}>
                    {candidate.fullName}
                  </button>
                  <p className={styles.meta}>
                    {job.title}
                    <span aria-hidden="true"> · </span>
                    <span title={format.dateTime(since)}>{t('applications:funnel.since', { time: format.relative(since) })}</span>
                  </p>
                </div>
                <div className={styles.actions}>
                  {application.noteCount > 0 && (
                    <button type="button" className={styles.notes} onClick={() => onOpen(application.id)} aria-label={t('applications:board.notes', { count: application.noteCount })}>
                      <Icon as={MessageSquareText} size={12} />
                      {application.noteCount}
                    </button>
                  )}
                  <ApplicationStageSelect
                    application={application}
                    stages={stages}
                    candidateName={candidate.fullName}
                    jobTitle={job.title}
                    label={t('applications:board.move', { name: candidate.fullName })}
                  />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
