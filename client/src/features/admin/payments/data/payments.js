/*
 * Sample payments for the admin Payments page only (P5-Q1), in the server's row shape (M-122, U24), until Phase 10
 * reads GET /admin/payments. Candidate and recruiter Billing read their own rows from the server.
 */
export const PAYMENT_STATUS = {
  paid: { label: 'Paid', tone: 'success' },
  failed: { label: 'Failed', tone: 'danger' },
  refunded: { label: 'Refunded', tone: 'neutral' },
}

export const PAYMENT_KIND_LABEL = { course: 'Course', subscription: 'Subscription' }
export const PAYER_ROLE_LABEL = { candidate: 'Candidate', recruiter: 'Recruiter' }

export const formatMoney = (amountMinor) => `£${(amountMinor / 100).toFixed(2)}`

const DECLINED = 'Card declined by the issuer (demo decline card).'

function sample(number, fields) {
  return { id: `sample-payment-${number}`, reference: `LWM-${String(number).padStart(6, '0')}`, currency: 'GBP', receiptUrl: null, ...fields }
}

const card = (brand, last4) => ({ type: 'card', brand, last4 })

export const SAMPLE_PAYMENTS = [
  sample(6, { paidAt: '2026-10-20T08:15:00.000Z', payerRole: 'recruiter', payerName: 'Sarah Miller', kind: 'course', itemName: 'Talent Strategy & Workforce Planning', amountMinor: 2900, method: card('visa', '0002'), status: 'failed', failureReason: DECLINED }),
  sample(5, { paidAt: '2026-10-18T11:30:00.000Z', payerRole: 'candidate', payerName: 'Emma Wilson', kind: 'course', itemName: 'Interaction systems in practice', amountMinor: 3900, method: card('visa', '4242'), status: 'paid' }),
  sample(4, { paidAt: '2026-10-14T16:22:00.000Z', payerRole: 'candidate', payerName: 'James Chen', kind: 'course', itemName: 'Design leadership in practice', amountMinor: 4900, method: card('visa', '0002'), status: 'failed', failureReason: DECLINED }),
  sample(3, { paidAt: '2026-10-12T09:05:00.000Z', payerRole: 'candidate', payerName: 'Emma Wilson', kind: 'subscription', itemName: 'Plus', amountMinor: 900, method: card('visa', '4242'), status: 'paid' }),
  sample(2, { paidAt: '2026-10-03T14:40:00.000Z', payerRole: 'recruiter', payerName: 'Sarah Miller', kind: 'course', itemName: 'Hiring Technology & Product Talent', amountMinor: 4900, method: card('mastercard', '4444'), status: 'paid' }),
  sample(1, { paidAt: '2026-09-26T10:12:00.000Z', payerRole: 'candidate', payerName: 'Alex Morgan', kind: 'course', itemName: 'Interaction design foundations', amountMinor: 4900, method: card('visa', '4242'), status: 'paid' }),
]
