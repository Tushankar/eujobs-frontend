import { useTranslation } from 'react-i18next'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { Plus, UserPlus } from 'lucide-react'
import PageTitle from '@/components/common/PageTitle.jsx'
import { Button, Icon } from '@/components/ui'
import { can } from '@/app/permissions.js'
import { WORKSPACES, workspacePath } from '@/app/workspaces.js'
import { usePreferences } from '@/lib/preferences.js'

/** Shared heading for Roles and User access: Roles offers "Create custom role" (roles.create), User access "Invite admin" (users.add). */
export default function AccessManagementLayout() {
  const { t } = useTranslation('access')
  const { me } = usePreferences()
  const onUsers = useLocation().pathname.includes('/access-management/users')
  const action = onUsers
    ? can(me, 'users.add') && { to: 'access-management/users/invite', icon: UserPlus, label: t('invite') }
    : can(me, 'roles.create') && { to: 'access-management/roles/new', icon: Plus, label: t('createRole') }

  return (
    <>
      <PageTitle
        eyebrow={t('eyebrow')}
        title={t('title')}
        description={t('description')}
        actions={
          action && (
            <Button as={Link} to={workspacePath(WORKSPACES.admin, action.to)} leftIcon={<Icon as={action.icon} size={14} />}>
              {action.label}
            </Button>
          )
        }
      />
      <Outlet />
    </>
  )
}
