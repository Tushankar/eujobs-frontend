import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, Sparkles } from 'lucide-react'
import { Button, Icon, Panel } from '@/components/ui'
import PageTitle from '@/components/common/PageTitle.jsx'
import { PLUS_CHECKOUT_ITEM } from '@/features/candidate/billing/data/subscription.js'
import { useSubscription } from '@/features/candidate/billing/hooks/useSubscription.js'
import CheckoutDialog from '@/features/payments/components/CheckoutDialog.jsx'
import { useErrorText } from '@/lib/forms.js'
import { useFormat } from '@/lib/preferences.js'
import { useCompleteOnboardingMutation, useGetPlansQuery } from '../api.js'
import styles from './PlanStepPage.module.css'

/**
 * The plan step ends onboarding (M-014, M-129): plan cards from GET /plans in the user's currency. "Continue with
 * Free" completes onboarding and opens the Overview. The Plus button keeps the demo checkout until Phase 5.
 */
export default function PlanStepPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const format = useFormat()
  const errorText = useErrorText()
  const { data: plans = [] } = useGetPlansQuery()
  const [completeOnboarding, { isLoading }] = useCompleteOnboardingMutation()
  const { setPlan } = useSubscription()
  const [checkingOut, setCheckingOut] = useState(false)
  const [failure, setFailure] = useState(null)

  async function finish(path) {
    try {
      await completeOnboarding().unwrap()
      navigate(path)
    } catch (error) {
      setFailure(error)
    }
  }

  function handlePaid(payment) {
    setPlan('plus', payment.id)
    setCheckingOut(false)
    finish('/candidate/ai-insights')
  }

  return (
    <>
      <PageTitle eyebrow={t('onboarding:plan.eyebrow')} title={t('onboarding:plan.title')} description={t('onboarding:plan.lead')} />
      <div className={styles.column}>
        <div className={styles.grid}>
          {plans.map((plan) => (
            <Panel key={plan.key} padding={0}>
              <section className={styles.card} aria-labelledby={`plan-${plan.key}`}>
                <h2 id={`plan-${plan.key}`} className={styles.name}>
                  {plan.name}
                </h2>
                {plan.price && (
                  <p className={styles.price}>
                    {format.money(plan.price.amountMinor, plan.price.currency)}{' '}
                    <span>{t(plan.key === 'free' ? 'onboarding:plan.forever' : 'onboarding:plan.perMonth')}</span>
                  </p>
                )}
                <ul className={styles.features}>
                  {plan.features.map((feature) => (
                    <li key={feature}>
                      <Icon as={Check} size={14} /> {feature}
                    </li>
                  ))}
                </ul>
                {plan.key === 'free' ? (
                  <Button variant="secondary" fullWidth loading={isLoading} onClick={() => finish('/candidate')}>
                    {t('onboarding:plan.continueFree')}
                  </Button>
                ) : (
                  <Button fullWidth onClick={() => setCheckingOut(true)} leftIcon={<Icon as={Sparkles} size={14} />}>
                    {t('onboarding:plan.startPlus')}
                  </Button>
                )}
              </section>
            </Panel>
          ))}
        </div>
        {failure && <p role="alert">{errorText.code(failure)}</p>}
        <div className={styles.footer}>
          <Button as={Link} to="/candidate/onboarding/preferences" variant="ghost" leftIcon={<Icon as={ArrowLeft} size={12} />}>
            {t('onboarding:plan.back')}
          </Button>
        </div>
      </div>
      <CheckoutDialog item={checkingOut ? PLUS_CHECKOUT_ITEM : null} payerRole="candidate" onPaid={handlePaid} onClose={() => setCheckingOut(false)} />
    </>
  )
}
