import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { UserX } from 'lucide-react'
import EmptyState from '@/components/common/EmptyState.jsx'
import PillBadge from '@/components/common/PillBadge.jsx'
import SectionTitle from '@/components/common/SectionTitle.jsx'
import { Avatar, Button, Panel } from '@/components/ui'
import { WORKSPACES, workspacePath } from '@/app/workspaces.js'
import styles from './CandidateMovement.module.css'

/**
 * P10-Q13: one row per non-withdrawn application, newest first, optionally narrowed to one stage category. A card of
 * divided rows (the person, the job, shortlist and outreach state; the stage on the right) like the sidebar cards.
 */
export default function CandidateMovement({ rows, stage, onClearStage }) {
  const { t } = useTranslation(['adminRecruitment', 'enums'])
  const shown = stage ? rows.filter((row) => row.category === stage) : rows
  const stageLabel = stage && t(`enums:stageCategory.${stage}`)
  return (
    <Panel padding={24} aria-labelledby="candidate-movement">
      <SectionTitle id="candidate-movement" title={t('movement.title')} description={t('movement.description')}>
        <Link to={workspacePath(WORKSPACES.admin, 'applications')} className={styles.link}>
          {t('movement.viewApplications')}
        </Link>
      </SectionTitle>
      <div className={styles.body}>
        {stage && (
          <p className={styles.filter} role="status">
            {t('movement.filtered', { stage: stageLabel })}
            <Button variant="ghost" size="sm" onClick={onClearStage}>
              {t('movement.clear')}
            </Button>
          </p>
        )}
        {shown.length > 0 ? (
          <ul className={styles.list} aria-label={t('movement.title')}>
            {shown.map((row) => (
              <li key={row.id} className={styles.row} data-movement-row>
                <Avatar name={row.candidate.name ?? ''} src={row.candidate.photoUrl ?? undefined} size={40} />
                <div className={styles.text}>
                  <p className={styles.name}>{row.candidate.name}</p>
                  <p className={styles.meta}>{t('movement.job', { job: row.job.title, company: row.company })}</p>
                  <p className={styles.meta}>
                    {t(row.shortlisted ? 'movement.shortlisted' : 'movement.notShortlisted')} · {t(row.outreach ? 'movement.outreachSent' : 'movement.noOutreach')}
                  </p>
                </div>
                <PillBadge tone={row.category === 'interview' ? 'accent' : 'neutral'}>{row.stageName ?? t(`enums:stageCategory.${row.category}`)}</PillBadge>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={UserX}
            title={stage ? t('movement.emptyStage', { stage: stageLabel }) : t('movement.empty')}
            description={stage ? t('movement.emptyStageText') : t('movement.emptyText')}
          />
        )}
      </div>
    </Panel>
  )
}
