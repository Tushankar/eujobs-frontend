import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Panel, SelectField, TextField } from '@/components/ui'
import NoticeBanner from '@/components/common/NoticeBanner.jsx'
import PageTitle from '@/components/common/PageTitle.jsx'
import { useUpdateMeMutation } from '@/app/api.js'
import ChangePasswordForm from '@/features/account/components/ChangePasswordForm.jsx'
import { LANGUAGES, languageName } from '@/i18n/index.js'
import { check, serverFieldErrors, useErrorText } from '@/lib/forms.js'
import { usePreferences } from '@/lib/preferences.js'
import styles from './AdminSettingsPage.module.css'

/**
 * Admin Settings (M-199, OD6): own name, password and language; no email preferences and no
 * permission needed. No Figma frame (OD16): built from PageTitle, Panel and the field components.
 */
export default function AdminSettingsPage() {
  const { t } = useTranslation()
  const errorText = useErrorText()
  const { me, language, setLanguage } = usePreferences()
  const [updateMe, { isLoading }] = useUpdateMeMutation()
  const [name, setName] = useState(me.fullName)
  const [nameError, setNameError] = useState(null)
  const [saved, setSaved] = useState(false)

  async function saveName(event) {
    event.preventDefault()
    const error = check.required(name)
    setNameError(error)
    setSaved(false)
    if (error) return
    try {
      await updateMe({ fullName: name.trim() }).unwrap()
      setSaved(true)
    } catch (failure) {
      setNameError(serverFieldErrors(failure).fullName ?? { key: 'invalid' })
    }
  }

  return (
    <>
      <PageTitle title={t('account:admin.title')} description={t('account:admin.description')} />
      <div className={styles.sections}>
        <Panel padding={28}>
          <h2 className={styles.heading}>{t('account:admin.profile')}</h2>
          <form className={styles.form} onSubmit={saveName} noValidate>
            <TextField
              label={t('auth:fields.fullName')}
              name="fullName"
              autoComplete="name"
              value={name}
              onChange={(event) => {
                setName(event.target.value)
                setNameError(null)
                setSaved(false)
              }}
              error={errorText.field('fullName', nameError)}
            />
            <TextField label={t('auth:fields.email')} name="email" value={me.email} disabled readOnly />
            {saved && <NoticeBanner>{t('account:admin.nameSaved')}</NoticeBanner>}
            <Button type="submit" loading={isLoading} className={styles.submit}>
              {t('account:admin.saveName')}
            </Button>
          </form>
        </Panel>

        <Panel padding={28}>
          <h2 className={styles.heading}>{t('shell:language.label')}</h2>
          <div className={styles.form}>
            <SelectField
              label={t('account:admin.language')}
              name="language"
              options={LANGUAGES.map((code) => ({ value: code, label: languageName(code) }))}
              value={language}
              onChange={(event) => setLanguage(event.target.value)}
            />
          </div>
        </Panel>

        <Panel padding={28}>
          <h2 className={styles.heading}>{t('account:password.title')}</h2>
          <p className={styles.description}>{t('account:password.description')}</p>
          <ChangePasswordForm />
        </Panel>
      </div>
    </>
  )
}
