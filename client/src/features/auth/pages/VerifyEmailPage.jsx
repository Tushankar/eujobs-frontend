import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'
import { Button, TextField } from '@/components/ui'
import AuthLayout from '@/components/layout/AuthLayout.jsx'
import { errorCode } from '@/app/api.js'
import { SIGN_IN_PATH } from '@/app/session.js'
import { useVerifyEmailMutation } from '../api.js'
import AuthIntro from '../components/AuthIntro.jsx'
import ResendVerification from '../components/ResendVerification.jsx'
import styles from './AuthFlowPage.module.css'

const STATE_BY_CODE = { TOKEN_EXPIRED: 'expired', TOKEN_USED: 'used' }

/** The emailed link (M-001): verifying → verified (no auto sign-in), expired (with Resend), used or invalid. */
export default function VerifyEmailPage() {
  const { t } = useTranslation()
  const token = useSearchParams()[0].get('token')
  const [verify] = useVerifyEmailMutation()
  const [result, setResult] = useState({ state: token ? 'verifying' : 'invalid' })
  const [email, setEmail] = useState('')
  // The link is single use, so it is opened once even when StrictMode runs the effect twice.
  const opened = useRef(false)

  useEffect(() => {
    if (!token || opened.current) return
    opened.current = true
    verify(token)
      .unwrap()
      .then(({ role }) => setResult({ state: 'verified', role }))
      .catch((error) => setResult({ state: STATE_BY_CODE[errorCode(error)] ?? 'invalid' }))
  }, [token, verify])

  const { state, role } = result

  return (
    <AuthLayout>
      <AuthIntro title={t(`auth:verifyEmail.${state}.title`)} />
      <div className={styles.body}>
        <p role={state === 'verifying' ? 'status' : undefined}>{t(`auth:verifyEmail.${state}.text`)}</p>
        {state === 'verified' && (
          <Button as={Link} to={SIGN_IN_PATH[role]} fullWidth>
            {t('auth:common.signIn')}
          </Button>
        )}
        {state === 'expired' && (
          <>
            <TextField
              label={t('auth:fields.email')}
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <ResendVerification email={email.trim()} />
          </>
        )}
        {(state === 'used' || state === 'invalid') && (
          <div className={styles.links}>
            <Link to="/sign-in">{t('auth:common.signIn')}</Link>
            <Link to="/sign-up">{t('auth:checkEmail.wrongAddress')}</Link>
          </div>
        )}
      </div>
    </AuthLayout>
  )
}
