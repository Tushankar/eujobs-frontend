import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { Settings2, ShieldCheck, Users } from 'lucide-react'
import { errorCode } from '@/app/api.js'
import { can } from '@/app/permissions.js'
import { WORKSPACES, workspacePath } from '@/app/workspaces.js'
import ConfirmDialog from '@/components/common/ConfirmDialog.jsx'
import EmptyState from '@/components/common/EmptyState.jsx'
import NoticeBanner from '@/components/common/NoticeBanner.jsx'
import StatCard from '@/components/common/StatCard.jsx'
import { useErrorText } from '@/lib/forms.js'
import { usePreferences } from '@/lib/preferences.js'
import { useArchiveRoleMutation, useDuplicateRoleMutation, useGetRolesQuery } from '../api.js'
import AccessToolbar from '../components/AccessToolbar.jsx'
import CreateRoleModal from '../components/CreateRoleModal.jsx'
import RoleCard, { RoleCardsSkeleton } from '../components/RoleCard.jsx'
import styles from './RolesPage.module.css'

const admin = (to) => workspacePath(WORKSPACES.admin, to)

/**
 * Roles tab (/admin/access-management), from the server (M-157, M-158). "Create custom role" (/roles/new) and the
 * prefilled edit dialog (/roles/:roleId/edit) open over this page. Each action shows only with its permission.
 */
export default function RolesPage() {
  const { t } = useTranslation('access')
  const errorText = useErrorText()
  const { me } = usePreferences()
  const navigate = useNavigate()
  const { pathname, state } = useLocation()
  const { roleId } = useParams()
  const { data: roles = [], isLoading } = useGetRolesQuery()
  const [duplicateRole] = useDuplicateRoleMutation()
  const [archiveRole] = useArchiveRoleMutation()
  const [query, setQuery] = useState('')
  const [archiving, setArchiving] = useState(null)
  const [problem, setProblem] = useState('')
  const notice = state?.notice

  const creating = pathname.endsWith('/roles/new') && can(me, 'roles.create')
  const editing = roleId && can(me, 'roles.edit') ? roles.find((role) => role.id === roleId) : null
  const needle = query.trim().toLowerCase()
  const visibleRoles = roles.filter((role) => [role.name, role.description].some((text) => text.toLowerCase().includes(needle)))
  const active = roles.filter((role) => role.status === 'active')

  const showNotice = (message) => navigate(admin('access-management'), { replace: true, state: { notice: message } })

  async function handleDuplicate(role) {
    setProblem('')
    try {
      const copy = await duplicateRole(role.id).unwrap()
      showNotice(t('role.duplicated', { source: role.name, name: copy.name }))
    } catch (error) {
      setProblem(errorText.code(error))
    }
  }

  async function handleArchive() {
    const role = archiving
    setArchiving(null)
    setProblem('')
    try {
      await archiveRole(role.id).unwrap()
      showNotice(t('role.archived', { name: role.name }))
    } catch (error) {
      setProblem(errorCode(error) === 'IN_USE' ? t('role.inUse', { count: error.data.error.params.count }) : errorText.code(error))
    }
  }

  return (
    <>
      <AccessToolbar active="roles" searchLabel={t('searchRoles')} query={query} onQueryChange={setQuery} />

      {notice && <NoticeBanner>{notice}</NoticeBanner>}
      {problem && (
        <p className={styles.problem} role="alert">
          {problem}
        </p>
      )}

      <div className={styles.stats}>
        <StatCard label={t('stats.activeRoles')} value={active.length} caption={t('stats.activeRolesCaption')} icon={ShieldCheck} loading={isLoading} />
        <StatCard label={t('stats.customRoles')} value={active.filter((role) => !role.system).length} caption={t('stats.customRolesCaption')} icon={Settings2} loading={isLoading} />
        <StatCard
          label={t('stats.assignedUsers')}
          value={roles.reduce((total, role) => total + role.assignedCount, 0)}
          caption={t('stats.assignedUsersCaption')}
          icon={Users}
          loading={isLoading}
        />
      </div>

      <div className={styles.roles}>
        {isLoading ? (
          <RoleCardsSkeleton className={styles.grid} />
        ) : visibleRoles.length > 0 ? (
          <div className={styles.grid}>
            {visibleRoles.map((role) => (
              <RoleCard
                key={role.id}
                role={role}
                manageUsersTo={admin('access-management/users')}
                actions={{
                  onDuplicate: can(me, 'roles.create') ? () => handleDuplicate(role) : null,
                  onEdit: can(me, 'roles.edit') ? () => navigate(admin(`access-management/roles/${role.id}/edit`)) : null,
                  onArchive: can(me, 'roles.archive') ? () => setArchiving(role) : null,
                }}
              />
            ))}
          </div>
        ) : (
          <EmptyState icon={ShieldCheck} title={t('role.noRoles')} description={t('role.noRolesText')} />
        )}
      </div>

      {(creating || editing) && (
        <CreateRoleModal
          key={editing?.id ?? 'new'}
          role={editing}
          onClose={() => navigate(admin('access-management'))}
          onSaved={(saved) => showNotice(t(editing ? 'role.updated' : 'role.created', { name: saved.name }))}
        />
      )}
      <ConfirmDialog
        open={archiving !== null}
        title={t('role.archiveTitle', { name: archiving?.name })}
        description={t('role.archiveText')}
        confirmLabel={t('role.archive')}
        tone="danger"
        onClose={() => setArchiving(null)}
        onConfirm={handleArchive}
      />
    </>
  )
}
