import { ShieldCheck } from 'lucide-react'
import PillBadge from '@/components/common/PillBadge.jsx'
import RowActionLink from '@/components/common/RowActionLink.jsx'
import { Button, Icon } from '@/components/ui'
import styles from './RoleCard.module.css'

/** One role: badges, description, permission / assigned-user counts, scope, and its actions. */
export default function RoleCard({ role, manageUsersTo, onDuplicate }) {
  return (
    <article className={styles.card} aria-labelledby={`role-${role.id}`}>
      <div className={styles.top}>
        <span className={styles.icon}>
          <Icon as={ShieldCheck} size={20} />
        </span>
        <div className={styles.badges}>
          <PillBadge tone={role.system ? 'info' : 'accent'}>{role.system ? 'System' : 'Custom'}</PillBadge>
          <PillBadge tone="success">Active</PillBadge>
        </div>
      </div>
      <h2 className={styles.name} id={`role-${role.id}`}>
        {role.name}
      </h2>
      <p className={styles.description}>{role.description}</p>
      <dl className={styles.counts}>
        <div>
          <dt>Permissions</dt>
          <dd>{role.permissions.length}</dd>
        </div>
        <div>
          <dt>Assigned users</dt>
          <dd>{role.assignedUsers}</dd>
        </div>
      </dl>
      <p className={styles.scope}>Scope: {role.scope}</p>
      <div className={styles.actions}>
        <Button variant="outline" onClick={onDuplicate} aria-label={`Duplicate ${role.name}`}>
          Duplicate
        </Button>
        <RowActionLink to={manageUsersTo} state={{ query: role.name }} aria-label={`Manage users with the ${role.name} role`}>
          Manage users
        </RowActionLink>
      </div>
    </article>
  )
}
