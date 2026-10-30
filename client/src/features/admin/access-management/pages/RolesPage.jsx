import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Settings2, ShieldCheck, Users } from 'lucide-react'
import EmptyState from '@/components/common/EmptyState.jsx'
import NoticeBanner from '@/components/common/NoticeBanner.jsx'
import StatCard from '@/components/common/StatCard.jsx'
import { WORKSPACES, workspacePath } from '@/app/workspaces.js'
import AccessToolbar from '../components/AccessToolbar.jsx'
import CreateRoleModal from '../components/CreateRoleModal.jsx'
import RoleCard from '../components/RoleCard.jsx'
import { useAccess } from '../hooks/useAccess.js'
import styles from './RolesPage.module.css'

const admin = (to) => workspacePath(WORKSPACES.admin, to)

/**
 * Roles tab (/admin/access-management). "Create custom role" is a dialog over this page
 * and has its own URL (/admin/access-management/roles/new).
 */
export default function RolesPage() {
  const { roles, users, addRole, duplicateRole } = useAccess()
  const navigate = useNavigate()
  const creating = useLocation().pathname.endsWith('/roles/new')
  const [query, setQuery] = useState('')
  const [notice, setNotice] = useState('')

  const needle = query.trim().toLowerCase()
  const visibleRoles = roles.filter((role) =>
    [role.name, role.description, role.scope].some((text) => text.toLowerCase().includes(needle)),
  )
  const customCount = roles.filter((role) => !role.system).length
  const assignedCount = users.filter((user) => user.role).length

  function handleCreate(values) {
    const role = addRole(values)
    setNotice(`Custom role "${role.name}" created. It is saved on this device.`)
    navigate(admin('access-management'))
  }

  function handleDuplicate(role) {
    const copy = duplicateRole(role)
    setNotice(`Duplicated "${role.name}" as "${copy.name}".`)
  }

  return (
    <>
      <AccessToolbar active="roles" searchLabel="Search roles" query={query} onQueryChange={setQuery} />

      {notice && <NoticeBanner>{notice}</NoticeBanner>}

      <div className={styles.stats}>
        <StatCard label="Active roles" value={roles.length} caption="System templates and custom roles" icon={ShieldCheck} />
        <StatCard label="Custom roles" value={customCount} caption="Reusable roles created by admins" icon={Settings2} />
        <StatCard label="Assigned users" value={assignedCount} caption="Users with configured frontend access" icon={Users} />
      </div>

      <div className={styles.roles}>
        {visibleRoles.length > 0 ? (
          <div className={styles.grid}>
            {visibleRoles.map((role) => (
              <RoleCard
                key={role.id}
                role={role}
                manageUsersTo={admin('access-management/users')}
                onDuplicate={() => handleDuplicate(role)}
              />
            ))}
          </div>
        ) : (
          <EmptyState icon={ShieldCheck} title="No roles match your search" description="Try a different name or clear the search box." />
        )}
      </div>

      {creating && (
        <CreateRoleModal
          existingNames={roles.map((role) => role.name)}
          onClose={() => navigate(admin('access-management'))}
          onCreate={handleCreate}
        />
      )}
    </>
  )
}
