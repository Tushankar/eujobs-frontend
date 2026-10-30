import { useState } from 'react'
import { Link, Outlet } from 'react-router-dom'
import { Check, Sparkles } from 'lucide-react'
import { Button, Icon, Panel } from '@/components/ui'
import PageTitle from '@/components/common/PageTitle.jsx'
import CheckoutDialog from '@/features/payments/components/CheckoutDialog.jsx'
import { PLANS, PLUS_CHECKOUT_ITEM } from '../data/subscription.js'
import { useSubscription } from '../hooks/useSubscription.js'
import styles from './PlusGate.module.css'

/** Layout route for AI insights: shows the pages to AI Matches Plus candidates, an upgrade screen to everyone else. */
export default function PlusGate() {
  const { isPlus, setPlan } = useSubscription()
  const [checkingOut, setCheckingOut] = useState(false)
  const plus = PLANS.plus

  if (isPlus) return <Outlet />

  return (
    <>
      <PageTitle
        eyebrow={plus.name}
        title="Unlock your AI insights"
        description="Profile insights, skill-gap guidance and match explanations are part of AI Matches Plus."
      />
      <Panel padding={28} className={styles.card}>
        <p className={styles.price}>
          {plus.price} <span>{plus.period}</span>
        </p>
        <ul className={styles.features}>
          {plus.features.map((feature) => (
            <li key={feature}>
              <Icon as={Check} size={14} /> {feature}
            </li>
          ))}
        </ul>
        <div className={styles.actions}>
          <Button onClick={() => setCheckingOut(true)} leftIcon={<Icon as={Sparkles} size={14} />}>
            Start {plus.name}
          </Button>
          <Button as={Link} to="/candidate/settings/billing" variant="secondary">
            Manage billing
          </Button>
        </div>
      </Panel>
      <CheckoutDialog
        item={checkingOut ? PLUS_CHECKOUT_ITEM : null}
        payerRole="candidate"
        onPaid={(payment) => setPlan('plus', payment.id)}
        onClose={() => setCheckingOut(false)}
      />
    </>
  )
}
