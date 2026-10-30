import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, PasswordField } from '@/components/ui'
import NoticeBanner from '@/components/common/NoticeBanner.jsx'
import { errorCode, useGetConfigQuery } from '@/app/api.js'
import { check, compact, serverFieldErrors, useErrorText } from '@/lib/forms.js'
import { useChangePasswordMutation } from '../api.js'
import styles from './ChangePasswordForm.module.css'

const EMPTY = { currentPassword: '', newPassword: '', confirmPassword: '' }

/** M-010: current + new password, in candidate and recruiter Data & account and in admin Settings. Other sessions stay signed in. */
export default function ChangePasswordForm() {
  const { t } = useTranslation()
  const errorText = useErrorText()
  const { data: config } = useGetConfigQuery()
  const [changePassword, { isLoading }] = useChangePasswordMutation()
  const [values, setValues] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [status, setStatus] = useState(null)

  const field = (name) => (event) => {
    setValues((current) => ({ ...current, [name]: event.target.value }))
    setErrors((current) => ({ ...current, [name]: undefined }))
    setStatus(null)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const nextErrors = compact({
      currentPassword: check.required(values.currentPassword),
      newPassword: check.newPassword(values.newPassword, config?.limits),
      confirmPassword: check.confirm(values.confirmPassword, values.newPassword),
    })
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return
    try {
      await changePassword({ currentPassword: values.currentPassword, newPassword: values.newPassword }).unwrap()
      setValues(EMPTY)
      setStatus({ saved: true })
    } catch (error) {
      setErrors(serverFieldErrors(error))
      if (errorCode(error) !== 'VALIDATION_FAILED') setStatus({ error })
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <PasswordField
        label={t('account:password.current')}
        name="currentPassword"
        autoComplete="current-password"
        value={values.currentPassword}
        onChange={field('currentPassword')}
        error={errorText.field('currentPassword', errors.currentPassword)}
      />
      <PasswordField
        label={t('account:password.new')}
        name="newPassword"
        autoComplete="new-password"
        hint={t('auth:fields.passwordHint', { min: config?.limits.password.min })}
        value={values.newPassword}
        onChange={field('newPassword')}
        error={errorText.field('newPassword', errors.newPassword)}
      />
      <PasswordField
        label={t('account:password.confirm')}
        name="confirmPassword"
        autoComplete="new-password"
        value={values.confirmPassword}
        onChange={field('confirmPassword')}
        error={errorText.field('confirmPassword', errors.confirmPassword)}
      />
      {status?.saved && <NoticeBanner>{t('account:password.saved')}</NoticeBanner>}
      {status?.error && <p role="alert">{errorText.code(status.error)}</p>}
      <Button type="submit" loading={isLoading} className={styles.submit}>
        {t('account:password.submit')}
      </Button>
    </form>
  )
}
