import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import { Link } from 'react-router-dom'
import { Check, ChevronDown, ChevronRight, Compass, Earth, MapPin, Users } from 'lucide-react'
import { startTour } from '@/app/tour.js'
import { cx } from '@/utils/cx.js'
import { Avatar, Dropdown, Icon } from '@/components/ui'
import { workspacePath } from '@/app/workspaces.js'
import { LANGUAGES, languageName } from '@/i18n/index.js'
import { useCountryOptions } from '@/lib/countries.js'
import { usePreferences, useFormat } from '@/lib/preferences.js'
import { identitySubtitle } from './identity.js'
import PlanBadge, { isPaidPlan } from './PlanBadge.jsx'
import styles from './ProfileMenu.module.css'

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

/** Avatar dropdown (Figma "Menu - Profile menu"): identity (M-195), profile link, country and language. */
export default function ProfileMenu({ workspace }) {
  const { t } = useTranslation()
  const { me, country, language, setCountry, setLanguage } = usePreferences()
  const format = useFormat()
  const countries = useCountryOptions()
  const dispatch = useDispatch()
  const [open, setOpen] = useState(null)
  const toggle = (row) => setOpen((current) => (current === row ? null : row))
  if (!me) return null
  const paid = isPaidPlan(me)

  return (
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

          <div className={styles.body}>
            <Link to={workspacePath(workspace, workspace.profilePath)} className={styles.row} onClick={close}>
              <Icon as={Users} size={16} />
              <span className={styles.rowLabel}>{t('shell:profileMenu.profile')}</span>
              <Icon as={ChevronRight} size={14} />
            </Link>

            {/* Candidates and recruiters can replay the first-login product tour. */}
            {workspace.id !== 'admin' && (
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
            )}

            {workspace.showLocation && (
              <>
                <button type="button" className={cx(styles.row, styles.rowTall)} aria-expanded={open === 'country'} onClick={() => toggle('country')}>
                  <Icon as={MapPin} size={16} />
                  <span className={styles.rowLabel}>{t('shell:country.label')}</span>
                  <span className={styles.rowValue}>{country && format.country(country)}</span>
                  <Icon as={ChevronDown} size={14} className={cx(open === 'country' && styles.flipped)} />
                </button>
                {open === 'country' && (
                  <>
                    <OptionList
                      className={styles.scroll}
                      options={countries.map((option) => ({ value: option.code, label: option.name }))}
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
          </div>
        </div>
      )}
    </Dropdown>
  )
}
