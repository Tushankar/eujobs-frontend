import { useNavigate } from 'react-router-dom'
import { Search, ShieldCheck, Users } from 'lucide-react'
import ViewToggle from '@/components/common/ViewToggle.jsx'
import { Icon, TextField } from '@/components/ui'
import { WORKSPACES, workspacePath } from '@/app/workspaces.js'
import styles from './AccessToolbar.module.css'

const TABS = [
  { id: 'roles', label: 'Roles', icon: ShieldCheck },
  { id: 'users', label: 'User access', icon: Users },
]

const PATHS = { roles: 'access-management', users: 'access-management/users' }

/** Roles / User access switch (each is its own route) plus the page's search box. */
export default function AccessToolbar({ active, searchLabel, query, onQueryChange }) {
  const navigate = useNavigate()

  return (
    <div className={styles.toolbar}>
      <ViewToggle
        label="Access management view"
        items={TABS}
        value={active}
        onChange={(next) => navigate(workspacePath(WORKSPACES.admin, PATHS[next]))}
      />
      <TextField
        className={styles.search}
        type="search"
        aria-label={searchLabel}
        placeholder={searchLabel}
        leftIcon={<Icon as={Search} size={15} />}
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
      />
    </div>
  )
}
