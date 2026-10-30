import { useEffect, useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { Navigate, useNavigate } from 'react-router-dom'
import { Button, TextField } from '@/components/ui'
import AuthLayout from '@/components/layout/AuthLayout.jsx'
import { errorCode, useGetConfigQuery } from '@/app/api.js'
import { signOut } from '@/app/session.js'
import { useCooldown, useErrorText } from '@/lib/forms.js'
import { usePreferences } from '@/lib/preferences.js'
import { useResendEmailCodeMutation, useVerifyEmailCodeMutation } from '../api.js'
import AuthIntro from '../components/AuthIntro.jsx'
import FormAlert from '../components/FormAlert.jsx'
import styles from './AuthFlowPage.module.css'

/**
 * M-002, M-004, U37: right after recruiter sign-up the emailed 6-digit code verifies the work email.
 * Resend opens 60 s after the last code; five wrong attempts lock the code.
 */
export default function EmailCodePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const errorText = useErrorText()
  const { me } = usePreferences()
  const { data: config } = useGetConfigQuery()
  const [verify, { isLoading }] = useVerifyEmailCodeMutation()
  const [resend, { isLoading: resending }] = useResendEmailCodeMutation()
  const cooldown = useCooldown()
  const startCooldown = cooldown.start
  const [code, setCode] = useState('')
  const [failure, setFailure] = useState(null)
  const [resent, setResent] = useState(false)
  const resendSeconds = config && config.limits.code.resendAfterMs / 1000

  // The code went out at sign-up, so resending opens one interval after arriving here (once the limit is known).
  useEffect(() => {
    if (resendSeconds) startCooldown(resendSeconds)
  }, [resendSeconds, startCooldown])

  if (me?.emailVerified) return <Navigate to="/recruiter/onboarding" replace />

  async function handleSubmit(event) {
    event.preventDefault()
    setFailure(null)
    setResent(false)
    try {
      await verify(code.trim()).unwrap()
      navigate('/recruiter/onboarding', { replace: true })
    } catch (error) {
      setFailure(error)
    }
  }

  async function handleResend() {
    setFailure(null)
    try {
      await resend().unwrap()
      setResent(true)
      setCode('')
      cooldown.start(resendSeconds)
    } catch (error) {
      setFailure(error)
      const retryAfter = error?.data?.error?.params?.retryAfter
      if (retryAfter) cooldown.start(retryAfter)
    }
  }

  const failureCode = failure && errorCode(failure)
  const fieldError = failureCode === 'CODE_INVALID' || failureCode === 'VALIDATION_FAILED' ? errorText.code(failure) : undefined

  return (
    <AuthLayout logoTo="/recruiter/sign-in">
      <AuthIntro title={t('auth:emailCode.title')} />
      <form className={styles.body} onSubmit={handleSubmit} noValidate>
        <p>
          <Trans i18nKey="auth:emailCode.sent" values={{ email: me?.email }} components={{ email: <span className={styles.address} /> }} />
        </p>
        {failure && !fieldError && <FormAlert>{errorText.code(failure)}</FormAlert>}
        {resent && <FormAlert tone="success">{t('auth:emailCode.resent')}</FormAlert>}
        <TextField
          className={styles.code}
          label={t('auth:emailCode.label')}
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={config?.limits.code.length}
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
          error={fieldError}
        />
        <Button type="submit" fullWidth loading={isLoading} disabled={!code}>
          {t('auth:emailCode.submit')}
        </Button>
        <div className={styles.links}>
          <button type="button" onClick={handleResend} disabled={cooldown.remaining > 0 || resending}>
            {cooldown.remaining > 0 ? t('auth:emailCode.resendIn', { count: cooldown.remaining }) : t('auth:emailCode.resend')}
          </button>
          <button
            type="button"
            onClick={() => {
              signOut()
              navigate('/recruiter/sign-up')
            }}
          >
            {t('auth:emailCode.otherAccount')}
          </button>
        </div>
      </form>
    </AuthLayout>
  )
}
