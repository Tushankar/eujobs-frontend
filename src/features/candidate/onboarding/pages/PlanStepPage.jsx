import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, Sparkles } from 'lucide-react'
import { Button, Icon, Panel } from '@/components/ui'
import PageTitle from '@/components/common/PageTitle.jsx'
import { useLocalStorage } from '@/hooks/useLocalStorage.js'
import { INITIAL_SUBSCRIPTION, PLANS, SUBSCRIPTION_STORAGE_KEY } from '../data/subscription.js'
import styles from './PlanStepPage.module.css'

/**
 * Shown after the profile is saved: choose Free or AI Matches Plus for AI job recommendations.
 * Prototype only. The confirmation records the subscription on this device; no payment method
 * is requested and nothing is charged.
 */
export default function PlanStepPage() {
  const navigate = useNavigate()
  const [, setSubscription] = useLocalStorage(SUBSCRIPTION_STORAGE_KEY, INITIAL_SUBSCRIPTION)
  const [confirming, setConfirming] = useState(false)
  const plus = PLANS.plus

  function chooseFree() {
    setSubscription({ plan: 'free', status: 'active', startedAt: new Date().toISOString() })
    navigate('/candidate/jobs')
  }

  function confirmPlus() {
    setSubscription({ plan: 'plus', status: 'active', startedAt: new Date().toISOString() })
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
              {confirming ? (
                <div className={styles.confirm} role="region" aria-label="Confirm subscription">
                  <p className={styles.note}>Prototype: no payment method is requested, nothing is charged, and no subscription is created with a payment provider.</p>
                  <Button fullWidth onClick={confirmPlus} leftIcon={<Icon as={Sparkles} size={14} />}>Confirm AI Matches Plus</Button>
                  <Button variant="ghost" fullWidth onClick={() => setConfirming(false)}>Cancel</Button>
                </div>
              ) : (
                <Button fullWidth onClick={() => setConfirming(true)} leftIcon={<Icon as={Sparkles} size={14} />}>Start AI Matches Plus</Button>
              )}
            </section>
          </Panel>
        </div>
        <div className={styles.footer}>
          <Button as={Link} to="/candidate/onboarding/preferences" variant="ghost" leftIcon={<Icon as={ArrowLeft} size={12} />}>Back</Button>
        </div>
      </div>
    </>
  )
}
