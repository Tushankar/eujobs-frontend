import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CircleCheck, CircleDashed, ShieldCheck } from 'lucide-react'
import { Button, Icon, PasswordField } from '@/components/ui'
import NoticeBanner from '@/components/common/NoticeBanner.jsx'
import { errorCode, useGetConfigQuery } from '@/app/api.js'
import { check, compact, serverFieldErrors, useErrorText } from '@/lib/forms.js'
import { usePreferences } from '@/lib/preferences.js'
import { cx } from '@/utils/cx.js'
import { useChangePasswordMutation } from '../api.js'
import styles from './ChangePasswordForm.module.css'

const EMPTY = { currentPassword: '', newPassword: '', confirmPassword: '' }

/** M-010: current + new password, in candidate and recruiter Data & account and in admin Settings. Other sessions stay signed in. */
export default function ChangePasswordForm() {
  const { t } = useTranslation()
  const errorText = useErrorText()
  const { data: config } = useGetConfigQuery()
  const { me } = usePreferences()
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

  // The server's rules (M-006), ticked live as the new password is typed; "very common" is only checked on save.
  const min = config?.limits.password.min
  const { newPassword, confirmPassword } = values
  const rules = [
    { key: 'length', done: Boolean(min) && newPassword.length >= min, text: t('account:password.rules.length', { min }) },
    { key: 'email', done: Boolean(newPassword) && newPassword.toLowerCase() !== me.email.split('@')[0].toLowerCase(), text: t('account:password.rules.email') },
    { key: 'match', done: Boolean(newPassword) && newPassword === confirmPassword, text: t('account:password.rules.match') },
  ]

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <div className={styles.grid}>
        <div className={styles.fields}>
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
        </div>
        <div className={styles.rules} data-password-rules>
          <p className={styles.rulesTitle}>{t('account:password.rules.title')}</p>
          <ul className={styles.ruleList}>
            {rules.map((rule) => (
              <li key={rule.key} className={cx(styles.rule, rule.done && styles.ruleDone)} data-rule={rule.key} data-done={rule.done || undefined}>
                <Icon as={rule.done ? CircleCheck : CircleDashed} size={16} />
                {rule.text}
              </li>
            ))}
            <li className={styles.rule}>
              <Icon as={ShieldCheck} size={16} />
              {t('account:password.rules.common')}
            </li>
          </ul>
        </div>
        <div className={styles.footer}>
          {status?.saved && <NoticeBanner>{t('account:password.saved')}</NoticeBanner>}
          {status?.error && <p role="alert">{errorText.code(status.error)}</p>}
          <Button type="submit" loading={isLoading} className={styles.submit}>
            {t('account:password.submit')}
          </Button>
        </div>
      </div>
    </form>
  )
}
