import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, Crown } from 'lucide-react'
import { Button, Icon, Panel } from '@/components/ui'
import { usePlan } from '@/features/candidate/billing/usePlan.js'
import CheckoutDialog from '@/features/payments/components/CheckoutDialog.jsx'
import IntervalSwitch from '@/features/payments/components/IntervalSwitch.jsx'
import { bestSaving } from '@/features/payments/bestSaving.js'
import PlanPrice from '@/features/payments/components/PlanPrice.jsx'
import { useErrorText } from '@/lib/forms.js'
import { cx } from '@/utils/cx.js'
import { useCompleteOnboardingMutation } from '../api.js'
import OnboardingStep from '../components/OnboardingStep.jsx'
import SetupSummary from '../components/SetupSummary.jsx'
import styles from './PlanStepPage.module.css'

/**
 * The plan step ends onboarding (M-014, M-129): plan cards from GET /plans in the header country's currency, monthly
 * or yearly (2026-11-13).
 * "Continue with Free" completes onboarding and opens the Overview; "Start Plus" goes through Stripe Checkout, whose
 * return page completes onboarding and opens AI insights (P3-C10). A subscriber only sees "You're on Plus".
 */
export default function PlanStepPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const errorText = useErrorText()
  const { isPlus, plans, plus, item } = usePlan()
  const [completeOnboarding, { isLoading }] = useCompleteOnboardingMutation()
  const [checkingOut, setCheckingOut] = useState(false)
  const [interval, setInterval] = useState('month')
  const saving = bestSaving(plans)
  const [failure, setFailure] = useState(null)

  async function finish(path) {
    try {
      await completeOnboarding().unwrap()
      navigate(path)
    } catch (error) {
      setFailure(error)
    }
  }

  return (
    <OnboardingStep
      step={3}
      title={t('onboarding:plan.title')}
      lead={t('onboarding:plan.lead')}
      aside={<SetupSummary />}
      framed={false}
      actions={
        <Button as={Link} to="/candidate/onboarding/preferences" variant="outline" leftIcon={<Icon as={ArrowLeft} size={14} />}>
          {t('onboarding:plan.back')}
        </Button>
      }
    >
      {isPlus ? (
        <Panel padding={28} className={styles.current} data-on-plan>
          <h2 className={styles.name}>
            <Icon as={Crown} size={16} strokeWidth={2} className={styles.crown} />
            {t('onboarding:plan.onPlan', { plan: plus?.name ?? t('enums:planKey.plus') })}
          </h2>
          <p className={styles.currentText}>{t('onboarding:plan.onPlanText')}</p>
          <Button loading={isLoading} onClick={() => finish('/candidate')}>
            {t('onboarding:plan.continue')}
          </Button>
        </Panel>
      ) : (
        <>
        {saving > 0 && <IntervalSwitch value={interval} onChange={setInterval} saving={saving} className={styles.interval} />}
        <div className={styles.grid}>
          {plans.map((plan) => {
            const paid = plan.key !== 'free'
            return (
              <Panel key={plan.key} padding={0} className={cx(styles.plan, paid && styles.paid)}>
                <section className={styles.card} aria-labelledby={`plan-${plan.key}`}>
                  <div className={styles.head}>
                    <h2 id={`plan-${plan.key}`} className={styles.name}>
                      {paid && <Icon as={Crown} size={16} strokeWidth={2} className={styles.crown} />}
                      {plan.name}
                    </h2>
                    <PlanPrice plan={plan} interval={interval} className={styles.price} />
                  </div>
                  <ul className={styles.features}>
                    {plan.features.map((feature) => (
                      <li key={feature}>
                        <Icon as={Check} size={15} strokeWidth={2.2} className={styles.check} />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  {paid ? (
                    <Button fullWidth onClick={() => setCheckingOut(true)}>
                      {t('onboarding:plan.startPlus')}
                    </Button>
                  ) : (
                    <Button variant="outline" fullWidth loading={isLoading} onClick={() => finish('/candidate')}>
                      {t('onboarding:plan.continueFree')}
                    </Button>
                  )}
                </section>
              </Panel>
            )
          })}
        </div>
        </>
      )}
      {failure && (
        <p className={styles.failure} role="alert">
          {errorText.code(failure)}
        </p>
      )}
      <CheckoutDialog item={checkingOut ? { ...item, interval } : null} plan={plus} onClose={() => setCheckingOut(false)} />
    </OnboardingStep>
  )
}
