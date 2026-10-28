import { useEffect, useState } from 'react'
import { Link, matchPath, useLocation, useMatches } from 'react-router-dom'
import { Bell, BriefcaseBusiness, Check, ChevronRight, Earth, Menu, MapPin, Search, Users } from 'lucide-react'
import { cx } from '@/utils/cx.js'
import { Dropdown, Icon, IconButton } from '@/components/ui'
import { WORKSPACES, workspacePath } from '@/app/workspaces.js'
import GlobalSearch from './GlobalSearch.jsx'
import ProfileMenu from './ProfileMenu.jsx'
import { LANGUAGES, LOCATIONS, useWorkspacePreferences } from './preferencesContext.js'
import styles from './Header.module.css'

const SWITCH_ICONS = { candidate: Users, recruiter: BriefcaseBusiness }

/** Current page title: a route `handle.title` wins, otherwise the matching sidebar item. */
function usePageTitle(workspace) {
  const { pathname } = useLocation()
  const matches = useMatches()
  const fromHandle = [...matches].reverse().find((match) => match.handle?.title)?.handle.title
  if (fromHandle) return fromHandle
  const item = workspace.nav.find((entry) =>
    matchPath({ path: workspacePath(workspace, entry.to), end: Boolean(entry.end) }, pathname),
  )
  return item?.label ?? 'Overview'
}

function WorkspaceSwitch({ workspace }) {
  return (
    <div className={styles.switch} role="group" aria-label="Switch workspace">
      {['candidate', 'recruiter'].map((id) => {
        const target = WORKSPACES[id]
        const active = id === workspace.id
        return (
          <Link
            key={id}
            to={target.basePath}
            className={cx(styles.switchOption, active && styles.switchActive)}
            aria-current={active ? 'true' : undefined}
          >
            <Icon as={SWITCH_ICONS[id]} size={12} />
            {target.label}
          </Link>
        )
      })}
    </div>
  )
}

function LocationDropdown() {
  const { location, setLocation } = useWorkspacePreferences()
  return (
    <Dropdown
      className={styles.hideBelowWide}
      trigger={(props) => (
        <button type="button" className={styles.pill} {...props}>
          <Icon as={MapPin} size={15} />
          <span className={styles.pillLabel}>{location}</span>
        </button>
      )}
    >
      {({ close }) => (
        <div className={styles.menu}>
          <ul>
            {LOCATIONS.map((option) => (
              <li key={option}>
                <button
                  type="button"
                  className={styles.menuItem}
                  onClick={() => {
                    setLocation(option)
                    close()
                  }}
                >
                  <span className={styles.menuCheck}>{option === location && <Icon as={Check} size={14} />}</span>
                  {option}
                </button>
              </li>
            ))}
          </ul>
          <p className={styles.menuNote}>Local marketplace preference for this workspace.</p>
        </div>
      )}
    </Dropdown>
  )
}

function LanguageDropdown() {
  const { language, setLanguage } = useWorkspacePreferences()
  return (
    <Dropdown
      className={styles.hideBelowWide}
      trigger={(props) => (
        <button type="button" className={styles.pill} {...props}>
          <Icon as={Earth} size={15} />
          {language}
        </button>
      )}
    >
      {({ close }) => (
        <div className={styles.menu}>
          {LANGUAGES.map((option) => (
            <button
              key={option}
              type="button"
              className={styles.menuItem}
              onClick={() => {
                setLanguage(option)
                close()
              }}
            >
              <span className={styles.menuCheck}>{option === language && <Icon as={Check} size={14} />}</span>
              {option}
            </button>
          ))}
        </div>
      )}
    </Dropdown>
  )
}

export default function Header({ workspace, onOpenMenu }) {
  const title = usePageTitle(workspace)
  const [searchOpen, setSearchOpen] = useState(false)

  useEffect(() => {
    function onKeyDown(event) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setSearchOpen(true)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <header className={styles.header} data-workspace={workspace.id}>
      <IconButton
        icon={Menu}
        label="Open navigation"
        className={styles.menuButton}
        onClick={onOpenMenu}
        aria-controls="workspace-sidebar"
      />
      <nav className={styles.breadcrumb} aria-label="Breadcrumb">
        <span className={styles.crumbRoot}>{workspace.label} workspace</span>
        <Icon as={ChevronRight} size={12} />
        <span className={styles.crumbCurrent} aria-current="page">
          {title}
        </span>
      </nav>

      <div className={styles.actions}>
        <button type="button" className={styles.search} onClick={() => setSearchOpen(true)}>
          <Icon as={Search} size={16} />
          <span className={styles.searchLabel}>Search anything...</span>
          <kbd className={styles.kbd}>⌘ K</kbd>
        </button>

        {workspace.showWorkspaceSwitch && <WorkspaceSwitch workspace={workspace} />}
        <LanguageDropdown />
        {workspace.showLocation && <LocationDropdown />}

        <div className={styles.identity}>
          <span className={styles.bell}>
            <IconButton icon={Bell} label="Notifications" />
            <span className={styles.bellDot} aria-hidden="true" />
          </span>
        </div>
        <ProfileMenu workspace={workspace} />
      </div>

      <GlobalSearch workspace={workspace} open={searchOpen} onClose={() => setSearchOpen(false)} />
    </header>
  )
}
