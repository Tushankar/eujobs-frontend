import { useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Button, TextField } from '@/components/ui'
import AuthLayout from '@/components/layout/AuthLayout.jsx'
import { check, compact, serverFieldErrors, useErrorText } from '@/lib/forms.js'
import { useForgotPasswordMutation } from '../api.js'
import AuthIntro from '../components/AuthIntro.jsx'
import FormAlert from '../components/FormAlert.jsx'
import { useFormState } from '../utils/useFormState.js'
import styles from './AuthFlowPage.module.css'

/** M-009: one page for all roles; the reply never says whether the address has an account. */
export default function ForgotPasswordPage() {
  const { t } = useTranslation()
  const errorText = useErrorText()
  const { values, errors, setErrors, field } = useFormState({ email: '' })
  const [forgot, { isLoading }] = useForgotPasswordMutation()
  const [sentTo, setSentTo] = useState(null)
  const [failure, setFailure] = useState(null)

  async function handleSubmit(event) {
    event.preventDefault()
    const nextErrors = compact({ email: check.email(values.email) })
    setErrors(nextErrors)
    setFailure(null)
    if (Object.keys(nextErrors).length > 0) return
    try {
      await forgot(values.email.trim()).unwrap()
      setSentTo(values.email.trim())
    } catch (error) {
      setErrors(serverFieldErrors(error))
      setFailure(error)
    }
  }

  return (
    <AuthLayout>
      <AuthIntro title={t('auth:forgot.title')} lead={sentTo ? undefined : t('auth:forgot.lead')} />
      {sentTo ? (
        <div className={styles.body}>
          <FormAlert tone="success">
            <span>
              <Trans i18nKey="auth:forgot.sent" values={{ email: sentTo }} components={{ email: <span className={styles.address} /> }} />
            </span>
          </FormAlert>
          <div className={styles.links}>
            <Link to="/sign-in">{t('auth:common.backToSignIn')}</Link>
          </div>
        </div>
      ) : (
        <form className={styles.body} onSubmit={handleSubmit} noValidate>
          {failure && !errors.email && <FormAlert>{errorText.code(failure)}</FormAlert>}
          <TextField
            label={t('auth:fields.email')}
            name="email"
            type="email"
            autoComplete="email"
            value={values.email}
            onChange={field('email')}
            error={errorText.field('email', errors.email)}
          />
          <Button type="submit" fullWidth loading={isLoading}>
            {t('auth:forgot.submit')}
          </Button>
          <div className={styles.links}>
            <Link to="/sign-in">{t('auth:common.backToSignIn')}</Link>
          </div>
        </form>
      )}
    </AuthLayout>
  )
}
