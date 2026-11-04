import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { Search } from 'lucide-react'
import { can } from '@/app/permissions.js'
import { WORKSPACES, workspacePath } from '@/app/workspaces.js'
import DataTable from '@/components/common/DataTable.jsx'
import EmptyState from '@/components/common/EmptyState.jsx'
import NoticeBanner from '@/components/common/NoticeBanner.jsx'
import PillBadge from '@/components/common/PillBadge.jsx'
import { Button } from '@/components/ui'
import { usePreferences } from '@/lib/preferences.js'
import { useGetAccessUsersQuery, useGetRolesQuery } from '../api.js'
import AccessToolbar from '../components/AccessToolbar.jsx'
import InviteDialog from '../components/InviteDialog.jsx'
import ManageAccessModal from '../components/ManageAccessModal.jsx'
import styles from './UserAccessPage.module.css'
import { useMarkSeen } from '@/features/notifications/api.js'

const admin = (to) => workspacePath(WORKSPACES.admin, to)
const STATUS_TONES = { active: 'success', invited: 'warning' }

/**
 * User access tab (/admin/access-management/users): admin staff only (M-154). "Manage access" (roles.assign) opens
 * /users/:userId, "Invite admin" (users.add) opens /users/invite. Owners cannot be changed (M-160).
 */
export default function UserAccessPage() {
  const { t } = useTranslation(['access', 'enums'])
  const { me } = usePreferences()
  const { userId } = useParams()
  // P11b-Q10: opening this item marks its notifications read.
  useMarkSeen('admin', userId)
  const { pathname, state } = useLocation()
  const navigate = useNavigate()
  const { data: users = [], isSuccess } = useGetAccessUsersQuery()
  const { data: roles = [] } = useGetRolesQuery()
  const [query, setQuery] = useState(state?.query ?? '')
  const activeRoles = roles.filter((role) => role.status === 'active')
  const canAssign = can(me, 'roles.assign')
  const inviting = pathname.endsWith('/users/invite') && can(me, 'users.add')

  const needle = query.trim().toLowerCase()
  const rows = users.filter((user) => [user.fullName, user.email, user.role?.name ?? '', user.department].some((text) => text.toLowerCase().includes(needle)))
  const selected = userId && userId !== 'invite' ? users.find((user) => user.id === userId) : null
  if (isSuccess && userId && userId !== 'invite' && (!selected || selected.isOwner || !canAssign)) return <Navigate to={admin('access-management/users')} replace />

  const backToList = (notice) => navigate(admin('access-management/users'), notice ? { state: { notice } } : undefined)

  const columns = [
    {
      key: 'user',
      header: t('users.user'),
      width: 282,
      render: (user) => (
        <>
          <p className={styles.name}>{user.fullName}</p>
          <p className={styles.email}>{user.email}</p>
        </>
      ),
    },
    {
      key: 'status',
      header: t('users.status'),
      width: 142,
      render: (user) =>
        user.isOwner ? <PillBadge tone="info">{t('users.owner')}</PillBadge> : <PillBadge tone={STATUS_TONES[user.status]}>{t(`enums:userStatus.${user.status}`)}</PillBadge>,
    },
    { key: 'role', header: t('users.role'), width: 168, render: (user) => <span className={styles.role}>{user.isOwner ? t('users.owner') : (user.role?.name ?? t('users.noRole'))}</span> },
    { key: 'department', header: t('users.department'), width: 155, render: (user) => <span className={styles.muted}>{user.department || t('users.noDepartment')}</span> },
    {
      key: 'effective',
      header: t('users.effective'),
      width: 161,
      render: (user) => <span className={styles.muted}>{user.isOwner ? t('users.ownerAccess') : t('users.permissionCount', { count: user.permissions.length })}</span>,
    },
    {
      key: 'actions',
      header: <span className="sr-only">{t('users.manage')}</span>,
      render: (user) =>
        user.isOwner || !canAssign ? null : (
          <Button
            as={Link}
            to={admin(`access-management/users/${user.id}`)}
            variant="outline"
            aria-label={t(user.role ? 'users.manageLabel' : 'users.assignLabel', { name: user.fullName })}
          >
            {user.role ? t('users.manage') : t('users.assign')}
          </Button>
        ),
    },
  ]

  return (
    <>
      <AccessToolbar active="users" searchLabel={t('searchUsers')} query={query} onQueryChange={setQuery} />

      {state?.notice && <NoticeBanner>{state.notice}</NoticeBanner>}

      <div className={styles.results}>
        {rows.length > 0 ? (
          <DataTable className={styles.table} columns={columns} rows={rows} getRowKey={(user) => user.id} caption={t('users.caption')} />
        ) : (
          isSuccess && <EmptyState icon={Search} title={t('users.noUsers')} description={t('users.noUsersText')} />
        )}
      </div>

      {selected && <ManageAccessModal key={selected.id} user={selected} roles={activeRoles} onClose={() => backToList()} onDone={backToList} />}
      {inviting && <InviteDialog roles={activeRoles} onClose={() => backToList()} onInvited={(invited) => backToList(t('users.invited', { email: invited.email }))} />}
    </>
  )
}
