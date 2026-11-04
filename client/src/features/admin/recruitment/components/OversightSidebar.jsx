import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import PillBadge from '@/components/common/PillBadge.jsx'
import SectionTitle from '@/components/common/SectionTitle.jsx'
import { Icon, Panel } from '@/components/ui'
import { WORKSPACES, workspacePath } from '@/app/workspaces.js'
import { useFormat } from '@/lib/preferences.js'
import styles from './OversightSidebar.module.css'

const admin = (to) => workspacePath(WORKSPACES.admin, to)
const STATUS_TONES = { applied: 'accent', under_review: 'accent', interview: 'success', offer: 'success', hired: 'success', not_selected: 'neutral' }

function ListRow({ title, meta, divided, children }) {
  return (
    <li className={divided ? styles.dividedRow : styles.row}>
      <div className={styles.rowText}>
        <p className={styles.rowTitle}>{title}</p>
        <p className={styles.rowMeta}>{meta}</p>
      </div>
      {children}
    </li>
  )
}

/** Right-hand column: the newest published roles, the newest applications and the "oversight, not hiring control" note. */
export default function OversightSidebar({ roles, coverage }) {
  const { t } = useTranslation(['adminRecruitment', 'enums'])
  const format = useFormat()
  const where = (role) => [t(`enums:workPreference.${role.workPreference}`), role.city ? `${role.city}, ${format.country(role.country)}` : format.country(role.country)].join(' · ')
  return (
    <aside className={`${styles.column} sticky-side`} aria-label={t('sidebar.label')}>
      <Panel padding={24} aria-labelledby="role-activity">
        <SectionTitle id="role-activity" title={t('sidebar.roles')} description={t('sidebar.rolesText')}>
          <Link to={admin('jobs?status=published')} className={styles.link}>
            {t('sidebar.manage')}
          </Link>
        </SectionTitle>
        {roles.length ? (
          <ul className={styles.list}>
            {roles.map((role) => (
              <ListRow key={role.id} title={role.title} meta={`${role.company} · ${where(role)}`} divided>
                <PillBadge tone="success" dot>
                  {t('enums:jobStatus.published')}
                </PillBadge>
              </ListRow>
            ))}
          </ul>
        ) : (
          <p className={styles.rowMeta}>{t('sidebar.noRoles')}</p>
        )}
      </Panel>
      <Panel padding={24} aria-labelledby="application-coverage">
        <SectionTitle id="application-coverage" title={t('sidebar.coverage')} description={t('sidebar.coverageText')} />
        {coverage.length ? (
          <ul className={styles.list}>
            {coverage.map((item) => (
              <ListRow key={item.id} title={item.job.title} meta={`${item.candidate.name} · ${format.date(item.appliedAt)}`}>
                <PillBadge tone={STATUS_TONES[item.status]}>{t(`enums:applicationStatus.${item.status}`)}</PillBadge>
              </ListRow>
            ))}
          </ul>
        ) : (
          <p className={styles.rowMeta}>{t('sidebar.noCoverage')}</p>
        )}
      </Panel>
      <Panel padding={24} className={styles.note} aria-labelledby="oversight-note">
        <h2 className={styles.noteTitle} id="oversight-note">
          {t('sidebar.noteTitle')}
        </h2>
        <p className={styles.noteText}>{t('sidebar.noteText')}</p>
        <Link to={admin('moderation')} className={styles.noteLink}>
          {t('sidebar.openModeration')}
          <Icon as={ArrowRight} size={12} />
        </Link>
      </Panel>
    </aside>
  )
}
