import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { Search } from 'lucide-react'
import DataTable from '@/components/common/DataTable.jsx'
import EmptyState from '@/components/common/EmptyState.jsx'
import NoticeBanner from '@/components/common/NoticeBanner.jsx'
import PillBadge from '@/components/common/PillBadge.jsx'
import { Button } from '@/components/ui'
import { WORKSPACES, workspacePath } from '@/app/workspaces.js'
import AccessToolbar from '../components/AccessToolbar.jsx'
import ManageAccessModal from '../components/ManageAccessModal.jsx'
import { useAccess } from '../hooks/useAccess.js'
import styles from './UserAccessPage.module.css'

const admin = (to) => workspacePath(WORKSPACES.admin, to)

const COLUMNS = [
  {
    key: 'user',
    header: 'User',
    width: 282,
    render: (user) => (
      <>
        <p className={styles.name}>{user.name}</p>
        <p className={styles.email}>{user.email}</p>
      </>
    ),
  },
  { key: 'platform', header: 'Platform type', width: 142, render: (user) => <PillBadge>{user.platform}</PillBadge> },
  {
    key: 'role',
    header: 'Access role',
    width: 168,
    render: (user) => <span className={styles.role}>{user.role?.name ?? 'No access role'}</span>,
  },
  {
    key: 'department',
    header: 'Department',
    width: 155,
    render: (user) => <span className={styles.muted}>{user.access.department || 'Not assigned'}</span>,
  },
  {
    key: 'effective',
    header: 'Effective access',
    width: 161,
    render: (user) => (
      <span className={styles.muted}>
        {user.effective.size} {user.effective.size === 1 ? 'permission' : 'permissions'}
      </span>
    ),
  },
  {
    key: 'actions',
    header: <span className="sr-only">Actions</span>,
    render: (user) => (
      <Button
        as={Link}
        to={admin(`access-management/users/${user.id}`)}
        variant="outline"
        aria-label={`${user.role ? 'Manage access' : 'Assign role'} for ${user.name}`}
      >
        {user.role ? 'Manage access' : 'Assign role'}
      </Button>
    ),
  },
]

/**
 * User access tab (/admin/access-management/users). "Manage access" / "Assign role" open a dialog over
 * the list at /admin/access-management/users/:userId.
 */
export default function UserAccessPage() {
  const { roles, users, saveUserAccess, revokeUserAccess } = useAccess()
  const { userId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const [query, setQuery] = useState(location.state?.query ?? '')
  const notice = location.state?.notice

  const needle = query.trim().toLowerCase()
  const rows = users.filter((user) =>
    [user.name, user.email, user.platform, user.role?.name ?? '', user.access.department].some((text) =>
      text.toLowerCase().includes(needle),
    ),
  )

  const selected = userId ? users.find((user) => user.id === userId) : null
  if (userId && !selected) return <Navigate to={admin('access-management/users')} replace />

  const backToList = (message) => navigate(admin('access-management/users'), message ? { state: { notice: message } } : undefined)

  return (
    <>
      <AccessToolbar active="users" searchLabel="Search users" query={query} onQueryChange={setQuery} />

      {notice && <NoticeBanner>{notice}</NoticeBanner>}

      <div className={styles.results}>
        {rows.length > 0 ? (
          <DataTable
            className={styles.table}
            columns={COLUMNS}
            rows={rows}
            getRowKey={(user) => user.id}
            caption="User access"
          />
        ) : (
          <EmptyState icon={Search} title="No users match your search" description="Try a different name, email or role." />
        )}
      </div>

      {selected && (
        <ManageAccessModal
          key={selected.id}
          user={selected}
          roles={roles}
          onClose={() => backToList()}
          onSave={(access) => {
            saveUserAccess(selected.id, access)
            backToList(`Access saved for ${selected.name}. It is stored on this device.`)
          }}
          onRevoke={() => {
            revokeUserAccess(selected.id)
            backToList(`Access revoked for ${selected.name}.`)
          }}
        />
      )}
    </>
  )
}
