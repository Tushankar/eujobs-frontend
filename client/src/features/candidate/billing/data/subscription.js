import { formatMoney } from '@/features/payments/data/payments.js'

/**
 * Candidate plan, stored on this device only: { plan: 'free' | 'plus', status: 'active', startedAt, paymentId? }.
 * No stored plan means Free. Plus is paid through the demo checkout and never renews: no further charges are made.
 */
export const SUBSCRIPTION_STORAGE_KEY = 'lwm.candidate.subscription'

export const INITIAL_SUBSCRIPTION = null

export const PLANS = {
  free: { id: 'free', name: 'Free', price: '£0', period: 'forever', features: ['Browse and apply to jobs', 'Basic job matches'] },
  plus: {
    id: 'plus',
    name: 'AI Matches Plus',
    price: '£9',
    amount: 9,
    period: 'per month',
    features: ['AI job recommendations tuned to your profile', 'Match reasons and skill-gap guidance', 'Priority review of your CV versions'],
  },
}

/** What the checkout dialog is asked to charge when a candidate starts AI Matches Plus. */
export const PLUS_CHECKOUT_ITEM = {
  kind: 'subscription',
  id: PLANS.plus.id,
  name: PLANS.plus.name,
  amount: PLANS.plus.amount,
  caption: `${formatMoney(PLANS.plus.amount)} ${PLANS.plus.period} · demo: no renewal charges are ever made`,
}
