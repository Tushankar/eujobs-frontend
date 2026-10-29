/*
 * Payments made through the demo checkout, shared by Candidate and Recruiter billing and the Admin Payments page.
 * Nothing is charged: each attempt (paid or declined) is only recorded on this device under PAYMENTS_STORAGE_KEY.
 *
 * kind        'course' | 'subscription'
 * payerRole   'candidate' | 'recruiter'; payerName is the account holder shown to the admin
 * status      'paid' | 'failed' (a declined card is kept as a failed attempt, with `failureReason`)
 * method      { brand, last4 }: the only card details ever kept
 * reference   LWM-xxxxx, unique per attempt
 */
export const PAYMENTS_STORAGE_KEY = 'lwm.payments'

export const PAYMENT_STATUS = {
  paid: { label: 'Paid', tone: 'success' },
  failed: { label: 'Failed', tone: 'danger' },
}

export const PAYMENT_KIND_LABEL = { course: 'Course', subscription: 'Subscription' }
export const PAYER_ROLE_LABEL = { candidate: 'Candidate', recruiter: 'Recruiter' }

export const formatMoney = (amount) => `£${amount.toFixed(2)}`

/** "Oct 29, 2026" */
export function formatPaymentDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const DECLINED = 'Card declined by the issuer (demo decline card).'

function seed(number, fields) {
  return { id: `seed-payment-${number}`, reference: `LWM-${String(1000 + number).padStart(5, '0')}`, currency: 'GBP', ...fields }
}

/**
 * Sample payments present before this device records any: they match the demo accounts' starting purchases
 * (Alex Morgan's and Sarah Miller's first course) plus a few other payers so the admin list has something to filter.
 */
export const SEED_PAYMENTS = [
  seed(1, { at: '2026-09-26T10:12:00.000Z', payerRole: 'candidate', payerName: 'Alex Morgan', kind: 'course', itemId: 'interaction-design-foundations', itemName: 'Interaction design foundations', amount: 49, method: { brand: 'Visa', last4: '4242' }, status: 'paid' }),
  seed(2, { at: '2026-10-03T14:40:00.000Z', payerRole: 'recruiter', payerName: 'Sarah Miller', kind: 'course', itemId: 'hiring-technology-product-talent', itemName: 'Hiring Technology & Product Talent', amount: 49, method: { brand: 'Mastercard', last4: '4444' }, status: 'paid' }),
  seed(3, { at: '2026-10-12T09:05:00.000Z', payerRole: 'candidate', payerName: 'Emma Wilson', kind: 'subscription', itemId: 'plus', itemName: 'AI Matches Plus', amount: 9, method: { brand: 'Visa', last4: '4242' }, status: 'paid' }),
  seed(4, { at: '2026-10-14T16:22:00.000Z', payerRole: 'candidate', payerName: 'James Chen', kind: 'course', itemId: 'design-leadership-in-practice', itemName: 'Design leadership in practice', amount: 49, method: { brand: 'Visa', last4: '0002' }, status: 'failed', failureReason: DECLINED }),
  seed(5, { at: '2026-10-18T11:30:00.000Z', payerRole: 'candidate', payerName: 'Emma Wilson', kind: 'course', itemId: 'interaction-systems-in-practice', itemName: 'Interaction systems in practice', amount: 39, method: { brand: 'Visa', last4: '4242' }, status: 'paid' }),
  seed(6, { at: '2026-10-20T08:15:00.000Z', payerRole: 'recruiter', payerName: 'Sarah Miller', kind: 'course', itemId: 'talent-strategy-workforce-planning', itemName: 'Talent Strategy & Workforce Planning', amount: 29, method: { brand: 'Visa', last4: '0002' }, status: 'failed', failureReason: DECLINED }),
]
