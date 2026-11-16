import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { matchPath, useLocation, useMatches } from 'react-router-dom'
import { Check, ChevronRight, Earth, Menu, MapPin, Search } from 'lucide-react'
import { Dropdown, Icon, IconButton } from '@/components/ui'
import { workspacePath } from '@/app/workspaces.js'
import { LANGUAGES, languageName } from '@/i18n/index.js'
import { useCountrySearch, usePickerOptions } from '@/lib/countries.js'
import { usePreferences, useFormat } from '@/lib/preferences.js'
import NotificationBell from '@/features/notifications/components/NotificationBell.jsx'
import GlobalSearch from './GlobalSearch.jsx'
import ProfileMenu from './ProfileMenu.jsx'
import ThemeToggle from './ThemeToggle.jsx'
import { useDocumentTitle } from './useDocumentTitle.js'
import styles from './Header.module.css'

// Ctrl K on Windows and Linux, ⌘ K on Apple devices (M-194).
const IS_APPLE = /mac|iphone|ipad/i.test(navigator.userAgentData?.platform ?? navigator.platform)

/** Current page title: a route `handle.titleKey` wins, otherwise the matching sidebar item. */
function usePageTitle(workspace) {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const matches = useMatches()
  const titleKey = [...matches].reverse().find((match) => match.handle?.titleKey)?.handle.titleKey
  if (titleKey) return t(`shell:${titleKey}`)
  const item = workspace.nav.find((entry) => matchPath({ path: workspacePath(workspace, entry.to), end: Boolean(entry.end) }, pathname))
  return t(`shell:nav.${item?.key ?? 'overview'}`)
}

function MenuOption({ selected, onSelect, children }) {
  return (
    <button type="button" className={styles.menuItem} aria-current={selected || undefined} onClick={onSelect}>
      <span className={styles.menuCheck}>{selected && <Icon as={Check} size={14} />}</span>
      {children}
    </button>
  )
}

/** The country list with a search box (worldwide since 2026-11-16: about 240 countries); Enter picks the first match. */
function CountryMenu({ options, selected, onPick }) {
  const { t } = useTranslation()
  const { query, setQuery, shown } = useCountrySearch(options)
  return (
    <div className={styles.menu}>
      <input
        className={styles.menuSearch}
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => event.key === 'Enter' && shown[0] && onPick(shown[0].code)}
        placeholder={t('shell:country.search')}
        aria-label={t('shell:country.search')}
        autoFocus
      />
      <ul className={styles.menuScroll}>
        {shown.map((option) => (
          <li key={option.code}>
            <MenuOption selected={option.code === selected} onSelect={() => onPick(option.code)}>
              {option.name}
            </MenuOption>
          </li>
        ))}
        {shown.length === 0 && <li className={styles.menuEmpty}>{t('shell:country.none')}</li>}
      </ul>
      <p className={styles.menuNote}>{t('shell:country.note')}</p>
    </div>
  )
}

/** M-135, M-137: the header country sets discovery, currency and formats. */
function CountryDropdown() {
  const { t } = useTranslation()
  const { view: country, setCountry } = usePreferences()
  const format = useFormat()
  const options = usePickerOptions()
  return (
    <Dropdown
      className={styles.hideBelowWide}
      trigger={(props) => (
        <button type="button" className={styles.pill} aria-label={t('shell:country.label')} {...props}>
          <Icon as={MapPin} size={15} />
          <span className={styles.pillLabel}>{country ? format.country(country) : t('shell:country.choose')}</span>
        </button>
      )}
    >
      {({ close }) => (
        <CountryMenu
          options={options}
          selected={country}
          onPick={(code) => {
            setCountry(code)
            close()
          }}
        />
      )}
    </Dropdown>
  )
}

function LanguageDropdown() {
  const { t } = useTranslation()
  const { language, setLanguage } = usePreferences()
  return (
    <Dropdown
      className={styles.hideBelowWide}
      trigger={(props) => (
        <button type="button" className={styles.pill} aria-label={t('shell:language.label')} {...props}>
          <Icon as={Earth} size={15} />
          {languageName(language)}
        </button>
      )}
    >
      {({ close }) => (
        <div className={styles.menu}>
          {LANGUAGES.map((option) => (
            <MenuOption
              key={option}
              selected={option === language}
              onSelect={() => {
                setLanguage(option)
                close()
              }}
            >
              <span lang={option}>{languageName(option)}</span>
            </MenuOption>
          ))}
        </div>
      )}
    </Dropdown>
  )
}

export default function Header({ workspace, onOpenMenu }) {
  const { t } = useTranslation()
  const title = usePageTitle(workspace)
  const [searchOpen, setSearchOpen] = useState(false)
  useDocumentTitle(title)

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
      <IconButton icon={Menu} label={t('shell:openNavigation')} className={styles.menuButton} onClick={onOpenMenu} aria-controls="workspace-sidebar" />
      <nav className={styles.breadcrumb} aria-label={t('shell:breadcrumb')}>
        <span className={styles.crumbRoot}>{t(`shell:workspaces.${workspace.id}.name`)}</span>
        <Icon as={ChevronRight} size={12} />
        <span className={styles.crumbCurrent} aria-current="page">
          {title}
        </span>
      </nav>

      <div className={styles.actions}>
        <button type="button" className={styles.search} onClick={() => setSearchOpen(true)}>
          <Icon as={Search} size={16} />
          <span className={styles.searchLabel}>{t('shell:search.trigger')}</span>
          <kbd className={styles.kbd}>{IS_APPLE ? '⌘ K' : t('shell:search.shortcut')}</kbd>
        </button>

        <LanguageDropdown />
        {workspace.showLocation && <CountryDropdown />}

        <div className={styles.identity}>
          <ThemeToggle />
          {/* P11b-Q2 (supersedes M-093, OD6): the unread count and the latest notifications. */}
          <NotificationBell workspace={workspace} />
        </div>
        <ProfileMenu workspace={workspace} />
      </div>

      <GlobalSearch workspace={workspace} open={searchOpen} onClose={() => setSearchOpen(false)} />
    </header>
  )
}
