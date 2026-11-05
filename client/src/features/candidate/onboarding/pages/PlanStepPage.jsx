import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Check } from 'lucide-react'
import { Button, Icon, Panel } from '@/components/ui'
import PageTitle from '@/components/common/PageTitle.jsx'
import { usePlan } from '@/features/candidate/billing/usePlan.js'
import CheckoutDialog from '@/features/payments/components/CheckoutDialog.jsx'
import { useErrorText } from '@/lib/forms.js'
import { useFormat } from '@/lib/preferences.js'
import { useCompleteOnboardingMutation } from '../api.js'
import styles from './PlanStepPage.module.css'

/**
 * The plan step ends onboarding (M-014, M-129): plan cards from GET /plans in the header country's currency.
 * "Continue with Free" completes onboarding and opens the Overview; "Start Plus" goes through Stripe Checkout, whose
 * return page completes onboarding and opens AI insights (P3-C10). A subscriber only sees "You're on Plus".
 */
export default function PlanStepPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const format = useFormat()
  const errorText = useErrorText()
  const { isPlus, plans, plus, item } = usePlan()
  const [completeOnboarding, { isLoading }] = useCompleteOnboardingMutation()
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

  return (
    <>
      <PageTitle eyebrow={t('onboarding:plan.eyebrow')} title={t('onboarding:plan.title')} description={t('onboarding:plan.lead')} />
      <div className={styles.column}>
        {isPlus ? (
          <Panel padding={24} className={styles.current} data-on-plan>
            <h2 className={styles.name}>{t('onboarding:plan.onPlan', { plan: plus?.name ?? t('enums:planKey.plus') })}</h2>
            <p className={styles.currentText}>{t('onboarding:plan.onPlanText')}</p>
            <Button loading={isLoading} onClick={() => finish('/candidate')}>
              {t('onboarding:plan.continue')}
            </Button>
          </Panel>
        ) : (
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
                    <Button fullWidth onClick={() => setCheckingOut(true)}>
                      {t('onboarding:plan.startPlus')}
                    </Button>
                  )}
                </section>
              </Panel>
            ))}
          </div>
        )}
        {failure && <p role="alert">{errorText.code(failure)}</p>}
        <div className={styles.footer}>
          <Button as={Link} to="/candidate/onboarding/preferences" variant="ghost" leftIcon={<Icon as={ArrowLeft} size={12} />}>
            {t('onboarding:plan.back')}
          </Button>
        </div>
      </div>
      <CheckoutDialog item={checkingOut ? item : null} onClose={() => setCheckingOut(false)} />
    </>
  )
}
