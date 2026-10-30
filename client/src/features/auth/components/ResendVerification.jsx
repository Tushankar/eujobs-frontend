import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useGetConfigQuery } from '@/app/api.js'
import { useCooldown, useErrorText } from '@/lib/forms.js'
import { useResendVerifyEmailMutation } from '../api.js'
import styles from './ResendVerification.module.css'

const MINUTE_SECONDS = 60

/**
 * Resend the verification link (M-001). The server always answers 202 and sends at most one email
 * per minute, so the wait is shown here: a second click inside the minute explains how long to wait.
 */
export default function ResendVerification({ email }) {
  const { t } = useTranslation()
  const errorText = useErrorText()
  const { data: config } = useGetConfigQuery()
  const [resend, { isLoading }] = useResendVerifyEmailMutation()
  const cooldown = useCooldown()
  const [state, setState] = useState(null)

  async function handleClick() {
    if (cooldown.remaining > 0) return setState({ status: 'wait' })
    try {
      await resend(email).unwrap()
      cooldown.start(MINUTE_SECONDS / (config?.limits.verifyEmailSends.perMinute ?? 1))
      setState({ status: 'sent' })
    } catch (error) {
      setState({ status: 'error', error })
    }
  }

  return (
    <div className={styles.resend}>
      <button type="button" className={styles.button} onClick={handleClick} disabled={isLoading}>
        {t('auth:resend.action')}
      </button>
      {state?.status === 'sent' && <span role="status">{t('auth:resend.sent', { email })}</span>}
      {state?.status === 'wait' && cooldown.remaining > 0 && <span role="alert">{t('auth:resend.wait', { count: cooldown.remaining })}</span>}
      {state?.status === 'error' && <span role="alert">{errorText.code(state.error)}</span>}
    </div>
  )
}
