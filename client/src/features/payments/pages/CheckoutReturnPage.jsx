import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Check, CircleAlert, LoaderCircle, Lock } from 'lucide-react'
import { api } from '@/app/api.js'
import { refreshMe, safeNext, WORKSPACE_PATH } from '@/app/session.js'
import { Button, Icon, Panel, Skeleton, SkeletonRegion } from '@/components/ui'
import { useCompleteOnboardingMutation } from '@/features/candidate/onboarding/api.js'
import { useErrorText } from '@/lib/forms.js'
import { useFormat, usePreferences } from '@/lib/preferences.js'
import { cx } from '@/utils/cx.js'
import { useGetCheckoutSessionQuery } from '../api.js'
import styles from './CheckoutReturnPage.module.css'

const POLL_MS = 1500
// Webhooks usually land within seconds; after this the page stops waiting and offers the way back.
const GIVE_UP_MS = 60_000

/**
 * Where Stripe returns after a payment (M-125), for candidates and recruiters: polls the session until the
 * webhook has applied it, refreshes plan, payments and enrolments, then goes back to the starting page. A candidate
 * still in onboarding (the plan step) finishes onboarding and opens AI insights (P3-C10).
 */
export default function CheckoutReturnPage() {
  const { t } = useTranslation('billing')
  const errorText = useErrorText()
  const format = useFormat()
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const { me } = usePreferences()
  const [params] = useSearchParams()
  const sessionId = params.get('session_id')
  const next = safeNext(params.get('from'))
  const from = next?.startsWith(WORKSPACE_PATH[me.role]) ? next : WORKSPACE_PATH[me.role]
  const [timedOut, setTimedOut] = useState(false)
  const { data: session, error } = useGetCheckoutSessionQuery(sessionId, { skip: !sessionId, pollingInterval: timedOut ? 0 : POLL_MS })
  const [completeOnboarding] = useCompleteOnboardingMutation()
  const fulfilled = Boolean(session?.fulfilled)
  const unpaid = session?.status === 'expired' || session?.status === 'open'

  useEffect(() => {
    const timer = window.setTimeout(() => setTimedOut(true), GIVE_UP_MS)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!fulfilled) return
    let cancelled = false
    async function finish() {
      dispatch(api.util.invalidateTags(['Me', 'Subscription', 'Payments', 'Enrollments']))
      const updated = await refreshMe()
      if (cancelled) return
      if (updated?.role === 'candidate' && !updated.onboardingCompleted) {
        await completeOnboarding().unwrap()
        navigate('/candidate/ai-insights', { replace: true })
      } else {
        navigate(from, { replace: true })
      }
    }
    finish()
    return () => {
      cancelled = true
    }
  }, [fulfilled, from, dispatch, navigate, completeOnboarding])

  const failure = !sessionId || error || unpaid || (timedOut && !fulfilled)
  const paid = session?.paymentStatus === 'paid' || session?.paymentStatus === 'no_payment_required'
  // Each step is done, active (spinner) or waiting, from the live session status.
  const steps = [
    { key: 'paid', title: t('return.stepPaid'), hint: t('return.stepPaidHint'), state: paid ? 'done' : 'active' },
    {
      key: 'apply',
      title: t(session?.kind === 'course' ? 'return.stepCourse' : 'return.stepPlan'),
      hint: t('return.stepApplyHint'),
      state: fulfilled ? 'done' : paid ? 'active' : 'waiting',
    },
    { key: 'back', title: t('return.stepBack'), hint: t('return.stepBackHint'), state: fulfilled ? 'active' : 'waiting' },
  ]

  // Order summary from the Stripe session (hidden when there is no session to describe).
  const summary = session && [
    { key: 'item', label: t('return.summaryItem'), value: session.itemName },
    { key: 'billing', label: t('return.summaryBilling'), value: t(session.interval ? 'return.billedMonthly' : 'return.billedOnce') },
    { key: 'date', label: t('return.summaryDate'), value: session.createdAt && format.date(session.createdAt) },
  ]
  const showSummary = sessionId && !error

  return (
    <div className={cx(styles.page, showSummary && styles.split)}>
      <Panel padding={0} className={styles.card}>
        <div className={styles.head}>
          <span className={cx(styles.mark, failure && styles.markAlert)}>
            <Icon as={failure ? CircleAlert : LoaderCircle} size={22} className={failure ? undefined : styles.spinner} />
          </span>
          <div className={styles.headText}>
            <p className={styles.eyebrow}>{t('return.eyebrow')}</p>
            <h1 className={styles.title}>{t(failure ? 'return.problemTitle' : 'return.title')}</h1>
            {failure ? (
              <p className={styles.lead} role="alert">
                {error ? errorText.code(error) : t(unpaid ? 'return.notPaid' : !sessionId ? 'return.missing' : 'return.slow')}
              </p>
            ) : (
              <p className={styles.lead}>{t('return.confirming')}</p>
            )}
            {failure && (
              <Button as={Link} to={from} variant="secondary" className={styles.back}>
                {t('return.back')}
              </Button>
            )}
          </div>
        </div>

        {!failure && (
          <ol className={styles.steps} role="status" aria-live="polite">
            {steps.map((step) => (
              <li key={step.key} className={cx(styles.step, styles[step.state])}>
                <span className={styles.stepIcon}>
                  {step.state === 'done' ? (
                    <Icon as={Check} size={14} strokeWidth={2.4} />
                  ) : step.state === 'active' ? (
                    <Icon as={LoaderCircle} size={16} className={styles.spinner} />
                  ) : null}
                </span>
                <span className={styles.stepText}>
                  <span className={styles.stepTitle}>{step.title}</span>
                  <span className={styles.stepHint}>{step.hint}</span>
                </span>
              </li>
            ))}
          </ol>
        )}

        <p className={styles.secure}>
          <Icon as={Lock} size={13} />
          {t('return.secure')}
        </p>
      </Panel>

      {showSummary && (
        <Panel as="aside" padding={0} className={cx(styles.card, 'sticky-side')} aria-labelledby="order-summary-title">
          <h2 id="order-summary-title" className={styles.summaryTitle}>
            {t('return.summaryTitle')}
          </h2>
          {summary ? (
            <dl className={styles.rows}>
              {summary.map((row) => (
                <div key={row.key} className={styles.row}>
                  <dt>{row.label}</dt>
                  <dd>{row.value}</dd>
                </div>
              ))}
              <div className={cx(styles.row, styles.total)}>
                <dt>{t('return.summaryTotal')}</dt>
                <dd>{format.money(session.amountMinor, session.currency)}</dd>
              </div>
            </dl>
          ) : (
            <SkeletonRegion className={styles.rows}>
              {[0, 1, 2, 3].map((index) => (
                <div key={index} className={styles.row}>
                  <Skeleton width={64} />
                  <Skeleton width={index === 0 ? 140 : 96} />
                </div>
              ))}
            </SkeletonRegion>
          )}
        </Panel>
      )}
    </div>
  )
}
