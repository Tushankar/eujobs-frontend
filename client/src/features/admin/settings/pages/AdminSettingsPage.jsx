import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Globe, KeyRound, Lock, Mail, UserRound } from 'lucide-react'
import { Avatar, Button, Icon, Panel, SelectField, TextField } from '@/components/ui'
import NoticeBanner from '@/components/common/NoticeBanner.jsx'
import PageTitle from '@/components/common/PageTitle.jsx'
import { useUpdateMeMutation } from '@/app/api.js'
import { identitySubtitle } from '@/components/layout/identity.js'
import ChangePasswordForm from '@/features/account/components/ChangePasswordForm.jsx'
import EmailSwitches from '@/features/notifications/components/EmailSwitches.jsx'
import { LANGUAGES, languageName } from '@/i18n/index.js'
import { check, serverFieldErrors, useErrorText } from '@/lib/forms.js'
import { usePreferences } from '@/lib/preferences.js'
import { cx } from '@/utils/cx.js'
import SettingsSidebar from '../components/SettingsSidebar.jsx'
import styles from './AdminSettingsPage.module.css'

/**
 * One settings row (LinkedIn style): grey icon, label, current value and an Edit pill. The whole head toggles the
 * row's form open below it; rows without `children` (the email) are read-only.
 */
function SettingRow({ id, icon, label, value, note, open, onToggle, children }) {
  const { t } = useTranslation()
  const text = (
    <>
      <Icon as={icon} size={20} className={styles.rowIcon} />
      <span className={styles.rowText}>
        <span className={styles.label}>{label}</span>
        {!open && <span className={styles.value}>{value}</span>}
      </span>
    </>
  )
  return (
    <li className={cx(styles.row, open && styles.rowOpen)} data-setting={id}>
      {children ? (
        <button type="button" className={styles.rowHead} aria-expanded={open} aria-controls={`setting-${id}`} onClick={onToggle}>
          {text}
          <span className={styles.pill}>{open ? t('common:cancel') : t('account:admin.edit')}</span>
        </button>
      ) : (
        <div className={styles.rowHead}>
          {text}
          <Icon as={Lock} size={16} className={styles.rowIcon} />
        </div>
      )}
      {note && !open && <div className={styles.note}>{note}</div>}
      {open && (
        <div id={`setting-${id}`} className={styles.rowBody}>
          {children}
        </div>
      )}
    </li>
  )
}

/**
 * Admin Settings (M-199): own name, password and language, and the email switches (P11b-Q3); no permission needed.
 * An identity card, then one card of rows that each open their own form; one row is open at a time.
 */
export default function AdminSettingsPage() {
  const { t } = useTranslation()
  const errorText = useErrorText()
  const { me, language, setLanguage } = usePreferences()
  const [updateMe, { isLoading }] = useUpdateMeMutation()
  const [open, setOpen] = useState(null)
  const [name, setName] = useState(me.fullName)
  const [nameError, setNameError] = useState(null)
  const [saved, setSaved] = useState(false)

  function toggle(row) {
    setOpen((current) => (current === row ? null : row))
    setName(me.fullName)
    setNameError(null)
    setSaved(false)
  }

  async function saveName(event) {
    event.preventDefault()
    const error = check.required(name)
    setNameError(error)
    if (error) return
    try {
      await updateMe({ fullName: name.trim() }).unwrap()
      setSaved(true)
      setOpen(null)
    } catch (failure) {
      setNameError(serverFieldErrors(failure).fullName ?? { key: 'invalid' })
    }
  }

  return (
    <>
      <PageTitle title={t('account:admin.title')} description={t('account:admin.description')} />
      <div className={styles.layout}>
        <div className={`${styles.sections} sticky-side`}>
          <Panel padding={24} className={styles.identity}>
            <Avatar name={me.fullName} size={64} />
            <div className={styles.identityText}>
              <h2 className={styles.name}>{me.fullName}</h2>
              <p className={styles.meta}>
                {me.email} · {identitySubtitle(me, t)}
              </p>
            </div>
          </Panel>

          <Panel padding={0} className={styles.card}>
            <h2 className={styles.heading}>{t('account:admin.profile')}</h2>
            <ul className={styles.rows}>
              <SettingRow
                id="name"
                icon={UserRound}
                label={t('auth:fields.fullName')}
                value={me.fullName}
                note={saved && <NoticeBanner>{t('account:admin.nameSaved')}</NoticeBanner>}
                open={open === 'name'}
                onToggle={() => toggle('name')}
              >
                <form className={styles.form} onSubmit={saveName} noValidate>
                  <TextField
                    label={<span className="sr-only">{t('auth:fields.fullName')}</span>}
                    name="fullName"
                    autoComplete="name"
                    value={name}
                    onChange={(event) => {
                      setName(event.target.value)
                      setNameError(null)
                    }}
                    error={errorText.field('fullName', nameError)}
                  />
                  <Button type="submit" loading={isLoading} className={styles.submit}>
                    {t('account:admin.saveName')}
                  </Button>
                </form>
              </SettingRow>

              <SettingRow id="email" icon={Mail} label={t('auth:fields.email')} value={<>{me.email}<span className={styles.hint}>{t('account:admin.emailNote')}</span></>} />

              <SettingRow id="language" icon={Globe} label={t('account:admin.language')} value={languageName(language)} open={open === 'language'} onToggle={() => toggle('language')}>
                <div className={styles.form}>
                  <SelectField
                    label={<span className="sr-only">{t('account:admin.language')}</span>}
                    name="language"
                    options={LANGUAGES.map((code) => ({ value: code, label: languageName(code) }))}
                    value={language}
                    onChange={(event) => setLanguage(event.target.value)}
                  />
                </div>
              </SettingRow>

              <SettingRow id="password" icon={KeyRound} label={t('auth:fields.password')} value="••••••••" open={open === 'password'} onToggle={() => toggle('password')}>
                <p className={styles.description}>{t('account:password.description')}</p>
                <ChangePasswordForm />
              </SettingRow>
            </ul>
          </Panel>

          {/* P11b-Q3, Q12 (supersedes OD6): the email switches of the admin's notification categories. */}
          <Panel padding={0} className={styles.card} data-card="notifications">
            <h2 className={styles.heading}>{t('notifications:settings.title')}</h2>
            <div className={styles.switches}>
              <EmailSwitches />
            </div>
          </Panel>
        </div>
        <SettingsSidebar me={me} />
      </div>
    </>
  )
}
