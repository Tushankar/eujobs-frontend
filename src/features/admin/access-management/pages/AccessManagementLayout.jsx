import { Link, Outlet, useLocation } from 'react-router-dom'
import { Plus } from 'lucide-react'
import PageTitle from '@/components/common/PageTitle.jsx'
import { Button, Icon } from '@/components/ui'
import { WORKSPACES, workspacePath } from '@/app/workspaces.js'

/** Shared heading for the Roles and User access screens; only Roles offers "Create custom role". */
export default function AccessManagementLayout() {
  const { pathname } = useLocation()
  const onUsers = pathname.includes('/access-management/users')

  return (
    <>
      <PageTitle
        eyebrow="Administration · Access control"
        title="Give people the access their work requires."
        description="Create reusable roles, assign them to users, and review effective permissions from one place."
        actions={
          onUsers ? null : (
            <Button as={Link} to={workspacePath(WORKSPACES.admin, 'access-management/roles/new')} leftIcon={<Icon as={Plus} size={14} />}>
              Create custom role
            </Button>
          )
        }
      />
      <Outlet />
    </>
  )
}
