import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { CircleAlert, LoaderCircle } from 'lucide-react'
import { api } from '@/app/api.js'
import { refreshMe, safeNext, WORKSPACE_PATH } from '@/app/session.js'
import { Button, Icon, Panel } from '@/components/ui'
import PageTitle from '@/components/common/PageTitle.jsx'
import { useCompleteOnboardingMutation } from '@/features/candidate/onboarding/api.js'
import { useErrorText } from '@/lib/forms.js'
import { usePreferences } from '@/lib/preferences.js'
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
  return (
    <>
      <PageTitle eyebrow={t('return.eyebrow')} title={t(failure ? 'return.problemTitle' : 'return.title')} />
      <Panel padding={24} className={styles.card}>
        {failure ? (
          <>
            <p className={styles.status} role="alert">
              <Icon as={CircleAlert} size={18} />
              {error ? errorText.code(error) : t(unpaid ? 'return.notPaid' : !sessionId ? 'return.missing' : 'return.slow')}
            </p>
            <Button as={Link} to={from} variant="secondary" className={styles.back}>
              {t('return.back')}
            </Button>
          </>
        ) : (
          <p className={styles.status} role="status">
            <Icon as={LoaderCircle} size={18} className={styles.spinner} />
            {t('return.confirming')}
          </p>
        )}
      </Panel>
    </>
  )
}
