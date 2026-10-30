import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, Sparkles } from 'lucide-react'
import { Button, Icon, Panel } from '@/components/ui'
import PageTitle from '@/components/common/PageTitle.jsx'
import { PLANS, PLUS_CHECKOUT_ITEM } from '@/features/candidate/billing/data/subscription.js'
import { useSubscription } from '@/features/candidate/billing/hooks/useSubscription.js'
import CheckoutDialog from '@/features/payments/components/CheckoutDialog.jsx'
import styles from './PlanStepPage.module.css'

/**
 * Shown after the profile is saved: choose Free or AI Matches Plus for AI job recommendations.
 * Plus is paid through the demo checkout (nothing is really charged) and the plan is recorded on this device.
 */
export default function PlanStepPage() {
  const navigate = useNavigate()
  const { setPlan } = useSubscription()
  const [checkingOut, setCheckingOut] = useState(false)
  const plus = PLANS.plus

  function chooseFree() {
    setPlan('free')
    navigate('/candidate/jobs')
  }

  function handlePaid(payment) {
    setPlan('plus', payment.id)
    setCheckingOut(false)
    navigate('/candidate/ai-insights')
  }

  return (
    <>
      <PageTitle eyebrow="Your profile is ready · Choose a plan" title="Get AI job recommendations" description="Pick how you want to be matched. You can change this later." />
      <div className={styles.column}>
        <div className={styles.grid}>
          <Panel padding={0}>
            <section className={styles.card} aria-labelledby="plan-free">
              <h2 id="plan-free" className={styles.name}>{PLANS.free.name}</h2>
              <p className={styles.price}>{PLANS.free.price} <span>{PLANS.free.period}</span></p>
              <ul className={styles.features}>
                {PLANS.free.features.map((item) => (
                  <li key={item}><Icon as={Check} size={14} /> {item}</li>
                ))}
              </ul>
              <Button variant="secondary" fullWidth onClick={chooseFree}>Continue with Free</Button>
            </section>
          </Panel>
          <Panel padding={0}>
            <section className={styles.card} aria-labelledby="plan-plus">
              <h2 id="plan-plus" className={styles.name}>{plus.name}</h2>
              <p className={styles.price}>{plus.price} <span>{plus.period}</span></p>
              <ul className={styles.features}>
                {plus.features.map((item) => (
                  <li key={item}><Icon as={Check} size={14} /> {item}</li>
                ))}
              </ul>
              <Button fullWidth onClick={() => setCheckingOut(true)} leftIcon={<Icon as={Sparkles} size={14} />}>Start AI Matches Plus</Button>
            </section>
          </Panel>
        </div>
        <div className={styles.footer}>
          <Button as={Link} to="/candidate/onboarding/preferences" variant="ghost" leftIcon={<Icon as={ArrowLeft} size={12} />}>Back</Button>
        </div>
      </div>
      <CheckoutDialog item={checkingOut ? PLUS_CHECKOUT_ITEM : null} payerRole="candidate" onPaid={handlePaid} onClose={() => setCheckingOut(false)} />
    </>
  )
}
