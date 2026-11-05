import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import PillBadge from '@/components/common/PillBadge.jsx'
import SectionTitle from '@/components/common/SectionTitle.jsx'
import { CompanyLogo, Icon, Panel, Skeleton, SkeletonRegion } from '@/components/ui'
import { WORKSPACES, workspacePath } from '@/app/workspaces.js'
import { useFormat } from '@/lib/preferences.js'
import styles from './OversightSidebar.module.css'

const admin = (to) => workspacePath(WORKSPACES.admin, to)
const STATUS_TONES = { applied: 'accent', under_review: 'accent', interview: 'success', offer: 'success', hired: 'success', not_selected: 'neutral' }

/** `company` = { name, id, logoUrl }: the company logo leads the row. */
function ListRow({ title, meta, company, divided, children }) {
  return (
    <li className={divided ? styles.dividedRow : styles.row}>
      {company?.name && <CompanyLogo name={company.name} id={company.id} src={company.logoUrl ?? undefined} size={32} />}
      <div className={styles.rowText}>
        <p className={styles.rowTitle}>{title}</p>
        <p className={styles.rowMeta}>{meta}</p>
      </div>
      {children}
    </li>
  )
}

/* Title and meta widths (px) of the placeholder rows (the server sends up to 5). */
const SKELETON_ROWS = [
  [150, 190],
  [120, 160],
  [170, 200],
  [130, 150],
  [110, 180],
]

/** A card's rows while they load: the logo, title and meta, and the status badge when `badge`. */
function RowsSkeleton({ divided, badge }) {
  return (
    <SkeletonRegion>
      <ul className={styles.list}>
        {SKELETON_ROWS.map(([title, meta], index) => (
          <li key={index} className={divided ? styles.dividedRow : styles.row}>
            <Skeleton shape="block" width={32} height={32} />
            <div className={styles.rowText}>
              <p className={styles.rowTitle}>
                <Skeleton width={title} height={12} />
              </p>
              <p className={styles.rowMeta}>
                <Skeleton width={meta} />
              </p>
            </div>
            {badge && <Skeleton shape="pill" />}
          </li>
        ))}
      </ul>
    </SkeletonRegion>
  )
}

/** Right-hand column: the newest published roles, the newest applications and the "oversight, not hiring control" note. */
export default function OversightSidebar({ roles, coverage, loading }) {
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
        {loading ? (
          <RowsSkeleton divided />
        ) : roles.length ? (
          <ul className={styles.list}>
            {roles.map((role) => (
              <ListRow
                key={role.id}
                title={role.title}
                meta={`${role.company} · ${where(role)}`}
                company={{ name: role.company, id: role.companyId, logoUrl: role.companyLogoUrl }}
                divided
              />
            ))}
          </ul>
        ) : (
          <p className={styles.rowMeta}>{t('sidebar.noRoles')}</p>
        )}
      </Panel>
      <Panel padding={24} aria-labelledby="application-coverage">
        <SectionTitle id="application-coverage" title={t('sidebar.coverage')} description={t('sidebar.coverageText')} />
        {loading ? (
          <RowsSkeleton badge />
        ) : coverage.length ? (
          <ul className={styles.list}>
            {coverage.map((item) => (
              <ListRow
                key={item.id}
                title={item.job.title}
                meta={`${item.candidate.name} · ${format.date(item.appliedAt)}`}
                company={{ name: item.company, id: item.companyId, logoUrl: item.companyLogoUrl }}
              >
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
