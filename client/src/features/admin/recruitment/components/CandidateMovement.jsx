import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { UserX } from 'lucide-react'
import DataTable from '@/components/common/DataTable.jsx'
import EmptyState from '@/components/common/EmptyState.jsx'
import PillBadge from '@/components/common/PillBadge.jsx'
import SectionTitle from '@/components/common/SectionTitle.jsx'
import { Avatar, Button } from '@/components/ui'
import { WORKSPACES, workspacePath } from '@/app/workspaces.js'
import styles from './CandidateMovement.module.css'

/** P10-Q13: one row per non-withdrawn application, newest first, optionally narrowed to one stage category. */
export default function CandidateMovement({ rows, stage, onClearStage }) {
  const { t } = useTranslation(['adminRecruitment', 'enums'])
  const shown = stage ? rows.filter((row) => row.category === stage) : rows
  const stageLabel = stage && t(`enums:stageCategory.${stage}`)
  const columns = [
    {
      key: 'candidate',
      header: t('movement.candidate'),
      width: 278,
      render: (row) => (
        <div className={styles.person}>
          <Avatar name={row.candidate.name ?? ''} size={32} />
          <div>
            <p className={styles.name}>{row.candidate.name}</p>
            <p className={styles.title}>{t('movement.job', { job: row.job.title, company: row.company })}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'stage',
      header: t('movement.stage'),
      width: 152,
      render: (row) => <PillBadge tone={row.category === 'interview' ? 'accent' : 'neutral'}>{row.stageName ?? t(`enums:stageCategory.${row.category}`)}</PillBadge>,
    },
    {
      key: 'shortlist',
      header: t('movement.shortlist'),
      width: 177,
      render: (row) => <PillBadge tone={row.shortlisted ? 'info' : 'neutral'}>{t(row.shortlisted ? 'movement.shortlisted' : 'movement.notShortlisted')}</PillBadge>,
    },
    { key: 'outreach', header: t('movement.outreach'), render: (row) => <span className={styles.outreach}>{t(row.outreach ? 'movement.outreachSent' : 'movement.noOutreach')}</span> },
  ]
  return (
    <section aria-labelledby="candidate-movement">
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
          <DataTable className={styles.table} columns={columns} rows={shown} getRowKey={(row) => row.id} caption={t('movement.title')} />
        ) : (
          <EmptyState
            icon={UserX}
            title={stage ? t('movement.emptyStage', { stage: stageLabel }) : t('movement.empty')}
            description={stage ? t('movement.emptyStageText') : t('movement.emptyText')}
          />
        )}
      </div>
    </section>
  )
}
