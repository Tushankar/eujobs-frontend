import { useTranslation } from 'react-i18next'
import { ShieldCheck } from 'lucide-react'
import PillBadge from '@/components/common/PillBadge.jsx'
import RowActionLink from '@/components/common/RowActionLink.jsx'
import { Button, Icon, Skeleton, SkeletonRegion } from '@/components/ui'
import styles from './RoleCard.module.css'

/** The role grid while it loads: six cards with the badges, name, description, counts, scope and actions. */
export function RoleCardsSkeleton({ className }) {
  const { t } = useTranslation('access')
  return (
    <SkeletonRegion className={className}>
      {[160, 120, 180, 140, 110, 150].map((width, index) => (
        <div key={index} className={styles.card}>
          <div className={styles.top}>
            <Skeleton shape="block" width={44} height={44} className={styles.skeletonIcon} />
            <div className={styles.badges}>
              <Skeleton shape="pill" width={56} />
              <Skeleton shape="pill" width={52} />
            </div>
          </div>
          <p className={styles.name}>
            <Skeleton width={width} height={18} />
          </p>
          <p className={styles.description}>
            <Skeleton width="95%" />
            <Skeleton width="70%" />
          </p>
          <div className={styles.counts}>
            {['permissions', 'assigned'].map((key) => (
              <div key={key}>
                <p className={styles.skeletonLabel}>{t(`role.${key}`)}</p>
                <p className={styles.skeletonValue}>
                  <Skeleton width={24} height={14} />
                </p>
              </div>
            ))}
          </div>
          <p className={styles.scope}>
            <Skeleton width={120} height={8} />
          </p>
          <div className={styles.actions}>
            <Skeleton shape="pill" height={40} />
            <Skeleton shape="pill" height={40} />
            <Skeleton shape="pill" height={40} />
            <span className={styles.skeletonLink}>
              <Skeleton width={120} height={12} />
            </span>
          </div>
        </div>
      ))}
    </SkeletonRegion>
  )
}

/**
 * One role: badges, description, permission / assigned-admin counts, scope, and the actions this admin may use
 * (`actions` holds only the permitted ones: onDuplicate, onEdit, onArchive). Archived roles show no actions.
 */
export default function RoleCard({ role, manageUsersTo, actions }) {
  const { t } = useTranslation(['access', 'enums'])
  const active = role.status === 'active'
  return (
    <article className={styles.card} aria-labelledby={`role-${role.id}`} data-role={role.name}>
      <div className={styles.top}>
        <span className={styles.icon}>
          <Icon as={ShieldCheck} size={20} />
        </span>
        <div className={styles.badges}>
          <PillBadge tone={role.system ? 'info' : 'accent'}>{role.system ? t('role.system') : t('role.custom')}</PillBadge>
          <PillBadge tone={active ? 'success' : 'neutral'}>{t(`enums:roleStatus.${role.status}`)}</PillBadge>
        </div>
      </div>
      <h2 className={styles.name} id={`role-${role.id}`}>
        {role.name}
      </h2>
      <p className={styles.description}>{role.description}</p>
      <dl className={styles.counts}>
        <div>
          <dt>{t('role.permissions')}</dt>
          <dd>{role.permissions.length}</dd>
        </div>
        <div>
          <dt>{t('role.assigned')}</dt>
          <dd>{role.assignedCount}</dd>
        </div>
      </dl>
      <p className={styles.scope}>{t('role.scope', { scope: role.scope ? t(`enums:roleScope.${role.scope}`) : '—' })}</p>
      {active && (
        <div className={styles.actions}>
          {actions.onDuplicate && (
            <Button variant="outline" onClick={actions.onDuplicate} aria-label={t('role.duplicateLabel', { name: role.name })}>
              {t('role.duplicate')}
            </Button>
          )}
          {actions.onEdit && (
            <Button variant="outline" onClick={actions.onEdit} aria-label={t('role.editLabel', { name: role.name })}>
              {t('role.edit')}
            </Button>
          )}
          {actions.onArchive && (
            <Button variant="outline" onClick={actions.onArchive} aria-label={t('role.archiveLabel', { name: role.name })}>
              {t('role.archive')}
            </Button>
          )}
          <RowActionLink to={manageUsersTo} state={{ query: role.name }} aria-label={t('role.manageUsersLabel', { name: role.name })}>
            {t('role.manageUsers')}
          </RowActionLink>
        </div>
      )}
    </article>
  )
}
