import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { ShieldCheck, Users } from 'lucide-react'
import ViewToggle from '@/components/common/ViewToggle.jsx'
import { TextField } from '@/components/ui'
import { WORKSPACES, workspacePath } from '@/app/workspaces.js'
import styles from './AccessToolbar.module.css'

const TABS = [
  { id: 'roles', icon: ShieldCheck },
  { id: 'users', icon: Users },
]

const PATHS = { roles: 'access-management', users: 'access-management/users' }

/**
 * Roles / User access switch (each is its own route) plus the page's search box. Neither Figma frame shows a
 * magnifier (it is hidden behind the input), so the box has none; the text sits 20px (Roles) / 40px (User access) in.
 */
export default function AccessToolbar({ active, searchLabel, query, onQueryChange }) {
  const { t } = useTranslation('access')
  const navigate = useNavigate()

  return (
    <div className={styles.toolbar}>
      <ViewToggle
        label={t('tabs.label')}
        items={TABS.map((tab) => ({ ...tab, label: t(`tabs.${tab.id}`) }))}
        value={active}
        onChange={(next) => navigate(workspacePath(WORKSPACES.admin, PATHS[next]))}
      />
      <TextField variant="filter"
        className={styles.search}
        type="search"
        aria-label={searchLabel}
        placeholder={searchLabel}
        style={{ paddingLeft: active === 'users' ? 24 : 4 }}
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
      />
    </div>
  )
}
