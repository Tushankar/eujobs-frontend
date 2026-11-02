import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Lock, ShieldAlert, ShieldCheck } from 'lucide-react'
import { refreshMe } from '@/app/session.js'
import { Button, Icon } from '@/components/ui'
import { useErrorText } from '@/lib/forms.js'
import { useFormat } from '@/lib/preferences.js'
import { cx } from '@/utils/cx.js'
import { useSubmitOnboardingMutation } from '../api.js'
import StepHeading from '../components/StepHeading.jsx'
import { stepPath } from '../data/onboarding.js'
import { useOnboarding } from '../utils/useOnboarding.js'
import styles from './AdminReviewPage.module.css'

/**
 * Onboarding step 5 of 5 (M-151, M-152, M-165): the review status. Pending waits for an admin; rejected shows the
 * reason with Edit and Resubmit; suspended shows the blocked message. Approval opens the workspace (the route
 * loader sends an approved recruiter there).
 */
export default function AdminReviewPage() {
  const { t } = useTranslation()
  const format = useFormat()
  const errorText = useErrorText()
  const { state } = useOnboarding()
  const [submit, { isLoading }] = useSubmitOnboardingMutation()
  const [failure, setFailure] = useState(null)
  const { status, decision } = state
  const blocked = status === 'suspended'

  const summary = [
    { key: 'applicant', value: state.account.fullName },
    { key: 'company', value: state.company?.legalName },
    { key: 'email', value: t('auth:onboarding.review.values.verified') },
    { key: 'phone', value: t('auth:onboarding.review.values.phoneConfirmed') },
    { key: 'documents', value: t('auth:onboarding.review.values.documents', { count: state.documents.length }) },
    { key: 'access', value: t(blocked ? 'auth:onboarding.review.values.blocked' : 'auth:onboarding.review.values.locked') },
  ]

  async function resubmit() {
    setFailure(null)
    try {
      await submit().unwrap()
      await refreshMe()
    } catch (error) {
      setFailure(error)
    }
  }

  return (
    <>
      <StepHeading title={t('auth:onboarding.review.title')} description={t('auth:onboarding.review.description')} />

      <div className={styles.result}>
        <div className={styles.status}>
          <span className={cx(styles.statusIcon, status !== 'pending_review' && styles.statusIconAlert)}>
            <Icon as={status === 'pending_review' ? ShieldCheck : ShieldAlert} size={29} />
          </span>
          <span className={cx(styles.statusBadge, status !== 'pending_review' && styles.statusBadgeAlert)}>{t(`auth:onboarding.review.badge.${status}`)}</span>
        </div>
        <div>
          <h3 className={styles.resultTitle}>{t(`auth:onboarding.review.${status}Title`)}</h3>
          <p className={styles.resultText}>{t(`auth:onboarding.review.${status}Text`)}</p>
          {status !== 'pending_review' && decision?.reason && (
            <p className={styles.reason}>
              {t('auth:onboarding.review.reason', { reason: decision.reason })}
              <span className={styles.reasonDate}>{t('auth:onboarding.review.decidedOn', { date: format.date(decision.at) })}</span>
            </p>
          )}
          {status === 'pending_review' && state.submittedAt && (
            <p className={styles.reasonDate}>{t('auth:onboarding.review.submittedOn', { date: format.date(state.submittedAt) })}</p>
          )}
        </div>
      </div>

      <dl className={styles.summary}>
        {summary.map((item) => (
          <div key={item.key} className={styles.summaryItem}>
            <dt className={styles.summaryLabel}>{t(`auth:onboarding.review.summary.${item.key}`)}</dt>
            <dd className={styles.summaryValue}>{item.value}</dd>
          </div>
        ))}
      </dl>

      {failure && <p role="alert" className={styles.error}>{errorText.code(failure)}</p>}
      <div className={styles.actions}>
        {status === 'rejected' ? (
          <>
            <Button as={Link} to={stepPath('company')} variant="outline">
              {t('auth:onboarding.review.edit')}
            </Button>
            <Button loading={isLoading} onClick={resubmit}>
              {t('auth:onboarding.review.resubmit')}
            </Button>
          </>
        ) : (
          <>
            <Button as={Link} to="/recruiter/sign-in" variant="outline">
              {t('auth:onboarding.review.signIn')}
            </Button>
            <Button disabled rightIcon={<Icon as={Lock} size={14} />} className={styles.locked}>
              {t('auth:onboarding.review.toolsLocked')}
            </Button>
          </>
        )}
      </div>
    </>
  )
}
