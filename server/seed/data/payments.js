/*
 * Payment history for seed:demo (OD8, OQ-4.2, P5-Q4). The paid course rows of the payments mock, dated the same number
 * of days before the seed run as the mock dates were before 2 Nov 2026; declined mock attempts are dropped (M-122).
 * Emma's Plus row comes from her real Stripe subscription instead of the mock row.
 */
export const COURSE_PAYMENTS = [
  { tag: 'alex', daysAgo: 37, itemName: 'Interaction design foundations', amount: 49, method: { brand: 'visa', last4: '4242' } },
  { tag: 'sarah', daysAgo: 30, itemName: 'Hiring Technology & Product Talent', amount: 49, method: { brand: 'mastercard', last4: '4444' } },
  { tag: 'emma', daysAgo: 15, itemName: 'Interaction systems in practice', amount: 39, method: { brand: 'visa', last4: '4242' } },
]

// OQ-4.2: each seeded applicant other than Emma paid one Plus month this many days ago and then lapsed.
export const HISTORICAL_PLUS_DAYS_AGO = 40
