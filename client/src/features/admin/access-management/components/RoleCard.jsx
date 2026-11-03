import { useTranslation } from 'react-i18next'
import { ShieldCheck } from 'lucide-react'
import PillBadge from '@/components/common/PillBadge.jsx'
import RowActionLink from '@/components/common/RowActionLink.jsx'
import { Button, Icon } from '@/components/ui'
import styles from './RoleCard.module.css'

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
