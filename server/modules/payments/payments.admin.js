import { csvAmount } from '../../lib/csv.js'
import { AppError } from '../../lib/errors.js'
import { t } from '../../lib/i18n.js'
import { paginate } from '../../lib/pages.js'
import { CandidateProfile } from '../candidates/candidates.model.js'
import { Company } from '../companies/companies.model.js'
import { User } from '../users/users.model.js'
import { Payment, Subscription } from './payments.model.js'
import { isPaid, PAID_PLAN, paymentDto } from './payments.service.js'
import { searchText } from '../../lib/skills.js'

/*
 * Admin › Payments (M-122, M-123, U34, P10-Q5 … Q7): every row of `payments`, Stripe and seeded, newest first.
 * A payment's country is the payer's (P10-Q6): a candidate's profile country, a recruiter's company country.
 * View only: no admin subscription actions in v1 (§8).
 */

/** userId → country code, for candidates and recruiters. */
async function payerCountries(userIds) {
  const [profiles, users] = await Promise.all([
    CandidateProfile.find({ userId: { $in: userIds } }, 'userId location'),
    User.find({ _id: { $in: userIds }, role: 'recruiter' }, 'companyId'),
  ])
  const companies = await Company.find({ _id: { $in: users.map((user) => user.companyId) } }, 'location')
  const companyCountry = new Map(companies.map((company) => [String(company._id), company.location?.countryCode]))
  const countries = new Map(profiles.map((profile) => [String(profile.userId), profile.location?.countryCode]))
  for (const user of users) countries.set(String(user._id), companyCountry.get(String(user.companyId)))
  return countries
}

const rowDto = (payment, countries) => ({
  ...paymentDto(payment),
  payerId: payment.userId ? String(payment.userId) : null,
  payerName: payment.payerName ?? null,
  payerRole: payment.payerRole ?? null,
  payerCountry: countries.get(String(payment.userId)) ?? null,
  failureReason: payment.failureReason ?? null,
  source: payment.source,
})

/** Rows with their payer country; `country` keeps only that country's payers (P10-Q6). */
async function rowsFor(filter, country) {
  const payments = await Payment.find(filter).sort({ paidAt: -1, _id: -1 })
  const countries = await payerCountries(payments.map((payment) => payment.userId).filter(Boolean))
  const rows = payments.map((payment) => rowDto(payment, countries))
  return country ? rows.filter((row) => row.payerCountry === country) : rows
}

export async function filteredPayments({ q, status, payer, kind, source, country }) {
  const filter = { ...(status && { status }), ...(payer && { payerRole: payer }), ...(kind && { kind }), ...(source && { source }) }
  const rows = await rowsFor(filter, country)
  const needle = q && searchText(q)
  return needle ? rows.filter((row) => [row.reference, row.payerName, row.itemName].some((text) => searchText(text).includes(needle))) : rows
}

export async function listPayments(query) {
  return paginate(await filteredPayments(query), query)
}

/** M-123: the row with its Stripe references and, for a plan payment, the payer's subscription status and period. */
export async function paymentDetail(id) {
  const payment = await Payment.findById(id)
  if (!payment) throw new AppError('NOT_FOUND')
  const [row] = await rowsFor({ _id: payment._id })
  const subscription = payment.kind === 'subscription' && payment.userId ? await Subscription.findOne({ userId: payment.userId }) : null
  return {
    ...row,
    stripe: { invoiceId: payment.stripe?.invoiceId ?? null, subscriptionId: payment.stripe?.subscriptionId ?? null, paymentIntentId: payment.stripe?.paymentIntentId ?? null },
    subscription: subscription && {
      status: subscription.status,
      paid: isPaid(subscription),
      retrying: subscription.retrying,
      currency: subscription.currency,
      amountMinor: subscription.amountMinor,
      currentPeriodStart: subscription.currentPeriodStart ?? null,
      currentPeriodEnd: subscription.currentPeriodEnd ?? null,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    },
  }
}

/** Per-currency totals, largest first (U34: the client shows at most 3 lines, then "+n more"). */
function perCurrency(entries) {
  const totals = new Map()
  for (const { currency, amountMinor } of entries) totals.set(currency, (totals.get(currency) ?? 0) + amountMinor)
  return [...totals].map(([currency, amountMinor]) => ({ currency, amountMinor })).sort((a, b) => b.amountMinor - a.amountMinor)
}

const ROLES = Object.keys(PAID_PLAN)
const roleOfPlan = Object.fromEntries(Object.entries(PAID_PLAN).map(([role, plan]) => [plan, role]))
/** `{ total, candidate, recruiter }` counts of `items` by `roleOf` (P11c-Q8). */
const countByRole = (items, roleOf) => ({ total: items.length, ...Object.fromEntries(ROLES.map((role) => [role, items.filter((item) => roleOf(item) === role).length])) })

/**
 * P10-Q7: all-time cards that follow only the country filter. Collected = paid rows (refunds excluded); Active
 * subscribers = paid subscriptions (U38); MRR = their monthly amounts per currency; Failed renewals = failed rows.
 * P11c-Q8: the plan cards are split by role (Plus = candidates, Recruiter Plus = recruiters).
 */
export async function paymentStats({ country }) {
  const rows = await rowsFor({}, country)
  const subscriptions = (await Subscription.find()).filter(isPaid)
  const countries = await payerCountries(subscriptions.map((subscription) => subscription.userId))
  const active = country ? subscriptions.filter((subscription) => countries.get(String(subscription.userId)) === country) : subscriptions
  return {
    collected: perCurrency(rows.filter((row) => row.status === 'paid')),
    activeSubscribers: countByRole(active, (subscription) => roleOfPlan[subscription.planKey]),
    mrr: Object.fromEntries(
      ROLES.map((role) => [
        role,
        perCurrency(active.filter((subscription) => roleOfPlan[subscription.planKey] === role).map(({ currency, amountMinor }) => ({ currency, amountMinor }))),
      ]),
    ),
    failedRenewals: countByRole(
      rows.filter((row) => row.status === 'failed' && row.kind === 'subscription'),
      (row) => row.payerRole,
    ),
  }
}

/** OQ-6d: headers and labels in the admin's language. */
export function exportRows(rows, language) {
  const label = (key) => t(language, `labels.${key}`)
  return [
    t(language, 'csv.payments'),
    ...rows.map((row) => [
      row.reference,
      new Date(row.paidAt).toISOString(),
      row.payerName ?? '',
      row.payerRole ? label(`payerRole.${row.payerRole}`) : '',
      row.itemName ?? '',
      label(`paymentKind.${row.kind}`),
      csvAmount(row.amountMinor),
      row.currency,
      row.method ? [row.method.brand ?? row.method.type, row.method.last4].filter(Boolean).join(' ') : '',
      label(`paymentStatus.${row.status}`),
      row.failureReason ?? '',
      label(`paymentSource.${row.source}`),
    ]),
  ]
}
