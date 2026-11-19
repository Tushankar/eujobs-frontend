import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowUpRight,
  Bookmark,
  Building2,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Compass,
  CreditCard,
  Earth,
  GraduationCap,
  LogOut,
  MapPin,
  Moon,
  Settings,
  Users,
} from 'lucide-react'
import { startTour } from '@/app/tour.js'
import { signOut } from '@/app/session.js'
import { cx } from '@/utils/cx.js'
import { Avatar, Dropdown, Icon, Switch } from '@/components/ui'
import ConfirmDialog from '@/components/common/ConfirmDialog.jsx'
import { useTheme } from '@/lib/theme.js'
import { useGetCandidateOverviewQuery } from '@/features/candidate/jobs/api.js'
import { workspacePath } from '@/app/workspaces.js'
import { LANGUAGES, languageName } from '@/i18n/index.js'
import { useCountrySearch, usePickerOptions } from '@/lib/countries.js'
import { usePreferences, useFormat } from '@/lib/preferences.js'
import { identitySubtitle } from './identity.js'
import PlanBadge from './PlanBadge.jsx'
import { isPaidPlan } from '@/lib/plans.js'
import styles from './ProfileMenu.module.css'

/** The country list with a search box (worldwide since 2026-11-16: about 240 countries); Enter picks the first match. */
function CountryOptions({ countries, selected, onSelect }) {
  const { t } = useTranslation()
  const { query, setQuery, shown } = useCountrySearch(countries)
  return (
    <>
      <input
        className={styles.search}
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => event.key === 'Enter' && shown[0] && onSelect(shown[0].code)}
        placeholder={t('shell:country.search')}
        aria-label={t('shell:country.search')}
        autoFocus
      />
      {shown.length ? (
        <OptionList className={styles.scroll} options={shown.map((option) => ({ value: option.code, label: option.name }))} selected={selected} onSelect={onSelect} />
      ) : (
        <p className={styles.optionsNote}>{t('shell:country.none')}</p>
      )}
    </>
  )
}

function OptionList({ options, selected, onSelect, className }) {
  return (
    <div className={cx(styles.options, className)}>
      {options.map((option) => {
        const isSelected = option.value === selected
        return (
          <button
            key={option.value}
            type="button"
            lang={option.lang}
            className={cx(styles.option, isSelected && styles.optionSelected)}
            aria-current={isSelected || undefined}
            onClick={() => onSelect(option.value)}
          >
            {isSelected && <Icon as={Check} size={13} />}
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

/** A link row of the menu: icon, label, an optional value (e.g. a count) and a trailing arrow. */
function LinkRow({ to, icon, label, value, external, onClick, ...rest }) {
  return (
    <Link to={to} className={styles.row} onClick={onClick} {...rest}>
      <Icon as={icon} size={16} />
      <span className={styles.rowLabel}>{label}</span>
      {value != null && <span className={styles.rowValue}>{value}</span>}
      <Icon as={external ? ArrowUpRight : ChevronRight} size={14} />
    </Link>
  )
}

/** The saved-jobs count of the candidate Overview (same cached query), shown on the Saved jobs row. */
function SavedJobsRow({ workspace, onClick }) {
  const { t } = useTranslation()
  const { data: overview } = useGetCandidateOverviewQuery()
  return (
    <LinkRow
      to={`${workspace.basePath}?tab=saved#jobs`}
      icon={Bookmark}
      label={t('shell:profileMenu.savedJobs')}
      value={overview?.savedJobs || undefined}
      onClick={onClick}
      data-menu-saved-jobs
    />
  )
}

/**
 * Avatar dropdown (Figma "Menu - Profile menu"; expanded 2026-11-19): identity (M-195), then groups split by thin lines —
 * the person's own pages (profile, saved jobs or shortlists, my courses), account (settings, billing, product tour),
 * preferences (country, language, dark mode) and help + sign out. Admins keep profile, language, theme, help, sign out.
 */
export default function ProfileMenu({ workspace }) {
  const { t } = useTranslation()
  const { me, view: country, language, setCountry, setLanguage } = usePreferences()
  const format = useFormat()
  const countries = usePickerOptions()
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { theme, toggle: toggleTheme } = useTheme()
  const [open, setOpen] = useState(null)
  const [confirmingSignOut, setConfirmingSignOut] = useState(false)
  const toggle = (row) => setOpen((current) => (current === row ? null : row))
  if (!me) return null
  const paid = isPaidPlan(me)
  const isAdmin = workspace.id === 'admin'
  const path = (to) => workspacePath(workspace, to)

  function handleSignOut() {
    setConfirmingSignOut(false)
    signOut()
    navigate(workspace.signInPath)
  }

  return (
    <>
    <Dropdown
      panelClassName={styles.panel}
      trigger={(props) => (
        <button type="button" className={styles.trigger} aria-label={t('shell:profileMenu.open')} {...props}>
          <Avatar name={me.fullName} src={(me.photoUrl ?? me.company?.logoUrl) ?? undefined} size={32} />
        </button>
      )}
    >
      {({ close }) => (
        <div className={styles.menu}>
          <div className={styles.identity}>
            <p className={styles.name}>{me.fullName}</p>
            <p className={styles.email}>{me.email}</p>
            {/* A paid plan (Plus, Recruiter Plus) shows as the premium badge; Free stays a text line. */}
            {!(me.role === 'candidate' && paid) && <p className={styles.role}>{identitySubtitle(me, t)}</p>}
            {/* P11c-Q19: a recruiter's plan (Free or Recruiter Plus) under the company. */}
            {me.role === 'recruiter' && !paid && <p className={styles.role} data-recruiter-plan>{t(`enums:planKey.${me.plan}`)}</p>}
            <PlanBadge me={me} />
          </div>

          <div className={styles.group}>
            <LinkRow
              to={path(workspace.profilePath)}
              icon={workspace.id === 'recruiter' ? Building2 : Users}
              label={t(workspace.id === 'recruiter' ? 'shell:profileMenu.companyProfile' : 'shell:profileMenu.profile')}
              onClick={close}
            />
            {workspace.id === 'candidate' && <SavedJobsRow workspace={workspace} onClick={close} />}
            {/* Shortlists are the recruiter's saved candidates (Recruiter Plus; without it the page shows the gate). */}
            {workspace.id === 'recruiter' && <LinkRow to={path('shortlists')} icon={Bookmark} label={t('shell:nav.shortlists')} onClick={close} />}
            {!isAdmin && (
              <LinkRow
                to={path(workspace.id === 'candidate' ? 'learning#my-courses' : 'settings/courses')}
                icon={GraduationCap}
                label={t('shell:profileMenu.myCourses')}
                onClick={close}
                data-menu-my-courses
              />
            )}
          </div>

          {!isAdmin && (
            <div className={styles.group}>
              <LinkRow to={path('settings')} icon={Settings} label={t('shell:sidebar.settings')} onClick={close} />
              <LinkRow to={path('settings/billing')} icon={CreditCard} label={t('shell:profileMenu.billing')} onClick={close} />
              {/* Candidates and recruiters can replay the first-login product tour. */}
              <button
                type="button"
                className={styles.row}
                onClick={() => {
                  close()
                  dispatch(startTour())
                }}
              >
                <Icon as={Compass} size={16} />
                <span className={styles.rowLabel}>{t('tour:replay')}</span>
                <Icon as={ChevronRight} size={14} />
              </button>
            </div>
          )}

          <div className={styles.group}>
            {workspace.showLocation && (
              <>
                <button type="button" className={styles.row} aria-expanded={open === 'country'} onClick={() => toggle('country')}>
                  <Icon as={MapPin} size={16} />
                  <span className={styles.rowLabel}>{t('shell:country.label')}</span>
                  <span className={styles.rowValue}>{country && format.country(country)}</span>
                  <Icon as={ChevronDown} size={14} className={cx(open === 'country' && styles.flipped)} />
                </button>
                {open === 'country' && (
                  <>
                    <CountryOptions
                      countries={countries}
                      selected={country}
                      onSelect={(code) => {
                        setCountry(code)
                        setOpen(null)
                      }}
                    />
                    <p className={styles.optionsNote}>{t('shell:country.note')}</p>
                  </>
                )}
              </>
            )}

            <button type="button" className={styles.row} aria-expanded={open === 'language'} onClick={() => toggle('language')}>
              <Icon as={Earth} size={16} />
              <span className={styles.rowLabel}>{t('shell:language.label')}</span>
              <span className={styles.rowValue}>{languageName(language)}</span>
              <Icon as={ChevronDown} size={14} className={cx(open === 'language' && styles.flipped)} />
            </button>
            {open === 'language' && (
              <OptionList
                options={LANGUAGES.map((code) => ({ value: code, label: languageName(code), lang: code }))}
                selected={language}
                onSelect={(code) => {
                  setLanguage(code)
                  setOpen(null)
                }}
              />
            )}

            {/* A <label> around the switch: clicking anywhere on the row flips it. */}
            <label className={styles.row} data-menu-theme>
              <Icon as={Moon} size={16} />
              <span className={styles.rowLabel}>{t('shell:profileMenu.darkMode')}</span>
              <Switch checked={theme === 'dark'} onChange={toggleTheme} label={t('shell:profileMenu.darkMode')} />
            </label>
          </div>

          <div className={styles.group}>
            <LinkRow to={path('help')} icon={CircleHelp} label={t('shell:sidebar.help')} external onClick={close} />
            <button
              type="button"
              className={styles.row}
              data-menu-sign-out
              onClick={() => {
                close()
                setConfirmingSignOut(true)
              }}
            >
              <Icon as={LogOut} size={16} />
              <span className={styles.rowLabel}>{t('shell:signOut')}</span>
            </button>
          </div>
        </div>
      )}
    </Dropdown>
    <ConfirmDialog
      open={confirmingSignOut}
      title={t('shell:signOutConfirm.title')}
      description={t('shell:signOutConfirm.description')}
      confirmLabel={t('shell:signOut')}
      onClose={() => setConfirmingSignOut(false)}
      onConfirm={handleSignOut}
    />
    </>
  )
}
