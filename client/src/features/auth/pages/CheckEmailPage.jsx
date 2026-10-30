import { Trans, useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router-dom'
import AuthLayout from '@/components/layout/AuthLayout.jsx'
import AuthIntro from '../components/AuthIntro.jsx'
import ResendVerification from '../components/ResendVerification.jsx'
import styles from './AuthFlowPage.module.css'

/** After candidate sign-up (M-001, U36): the same screen whether or not the address was already registered. */
export default function CheckEmailPage() {
  const { t } = useTranslation()
  const email = useLocation().state?.email

  return (
    <AuthLayout>
      <AuthIntro title={t('auth:checkEmail.title')} />
      <div className={styles.body}>
        <p>{email ? <Trans i18nKey="auth:checkEmail.sent" values={{ email }} components={{ email: <span className={styles.address} /> }} /> : t('auth:checkEmail.sentNoAddress')}</p>
        <p>{t('auth:checkEmail.expiry')}</p>
        {email && <ResendVerification email={email} />}
        <div className={styles.links}>
          <Link to="/sign-up">{t('auth:checkEmail.wrongAddress')}</Link>
          <Link to="/sign-in">{t('auth:common.backToSignIn')}</Link>
        </div>
      </div>
    </AuthLayout>
  )
}
