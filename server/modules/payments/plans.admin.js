import { z } from 'zod'
import { config } from '../../config/env.js'
import { ENUMS } from '../../config/enums.js'
import { actorFor, recordAudit } from '../../lib/audit.js'
import { AppError, fieldError } from '../../lib/errors.js'
import { callStripe, stripe } from '../../lib/stripe.js'
import { AppConfig, Plan, Subscription } from './payments.model.js'
import { isPaid } from './payments.service.js'
import { createPrice, ensurePortalConfiguration, yearlyAmount } from './plans.stripe.js'

/*
 * Admin › Payments › Plans (2026-11-13): names, features and prices of the plans. `finance.view` reads them,
 * `finance.manage` changes them. A changed price is a new Stripe Price used from then on by new subscribers only;
 * subscribers keep the price they signed up with. If Stripe fails, nothing is saved.
 */

const text = (max) => z.string().trim().min(1).max(max)
const localized = (max) => z.object({ en: text(max), es: text(max), fr: text(max) })

export const planParams = z.object({ key: z.enum(ENUMS.planKey) })
export const planBody = z.object({
  name: localized(40),
  features: z.array(localized(160)).min(1).max(12),
  yearlyEnabled: z.boolean().optional(),
  yearlyDiscountPercent: z.number().int().min(0).max(50).optional(),
  // Every currency of the plan; `yearlyMinor` null = 12 months less the discount.
  prices: z
    .array(
      z.object({
        currency: z.string().length(3),
        monthlyMinor: z.number().int().min(100).max(100_000_000),
        yearlyMinor: z.number().int().min(100).max(1_200_000_000).nullable(),
      }),
    )
    .optional(),
})

const order = (plan) => ENUMS.planKey.indexOf(plan.key)

/** One plan for the admin, with how many paying subscribers bill monthly or yearly and how many keep an older price. */
function planDto(plan, subscriptions) {
  const subscribers = subscriptions.filter((subscription) => subscription.planKey === plan.key)
  const current = (subscription) => (subscription.interval === 'year' ? plan.yearlyPrices : plan.prices).find((price) => price.currency === subscription.currency)
  return {
    key: plan.key,
    role: plan.role,
    paid: plan.prices.length > 0,
    name: plan.name,
    features: plan.features,
    yearlyEnabled: plan.yearlyEnabled,
    yearlyDiscountPercent: plan.yearlyDiscountPercent,
    prices: plan.prices.map(({ currency, amountMinor }) => {
      const yearly = plan.yearlyPrices.find((price) => price.currency === currency)
      return { currency, monthlyMinor: amountMinor, yearlyMinor: yearly?.amountMinor ?? null, yearlyOverride: Boolean(yearly?.override) }
    }),
    subscribers: {
      month: subscribers.filter((subscription) => subscription.interval !== 'year').length,
      year: subscribers.filter((subscription) => subscription.interval === 'year').length,
      olderPrice: subscribers.filter((subscription) => subscription.amountMinor !== current(subscription)?.amountMinor).length,
    },
    updatedAt: plan.updatedAt,
  }
}

const paidSubscriptions = async () => (await Subscription.find({}, 'planKey status retrying interval currency amountMinor').lean()).filter(isPaid)

export async function listPlans() {
  const [plans, subscriptions] = await Promise.all([Plan.find().lean(), paidSubscriptions()])
  return plans.sort((a, b) => order(a) - order(b)).map((plan) => planDto(plan, subscriptions))
}

/** Archives Prices this database created (admin prices); the seed's shared Prices stay. Best effort. */
async function archivePrices(ids) {
  await Promise.all(
    ids.map(async (id) => {
      try {
        const price = await stripe().prices.retrieve(id)
        if (price.metadata?.db === config.dbName && price.active) await stripe().prices.update(id, { active: false })
      } catch (error) {
        console.error(`Archiving Stripe price ${id} failed: ${error.message}`)
      }
    }),
  )
}

/** The plan's new monthly and yearly prices, checked against its currencies. */
function nextPrices(plan, body) {
  const currencies = plan.prices.map((price) => price.currency)
  const rows = body.prices ?? []
  if (rows.length !== currencies.length || !currencies.every((currency) => rows.some((row) => row.currency === currency))) throw fieldError({ prices: 'invalid' })
  const percent = body.yearlyDiscountPercent ?? plan.yearlyDiscountPercent
  return currencies.map((currency) => {
    const index = rows.findIndex((row) => row.currency === currency)
    const { monthlyMinor, yearlyMinor } = rows[index]
    // A yearly price never costs more than 12 months.
    if (yearlyMinor !== null && yearlyMinor > monthlyMinor * 12) throw fieldError({ [`prices.${index}.yearlyMinor`]: 'too_high' })
    return { currency, monthlyMinor, yearlyMinor: yearlyMinor ?? yearlyAmount(monthlyMinor, percent), override: yearlyMinor !== null }
  })
}

export async function updatePlan(admin, key, body) {
  const plan = await Plan.findOne({ key })
  if (!plan) throw new AppError('NOT_FOUND')
  const paid = plan.prices.length > 0
  if (!paid && (body.prices || body.yearlyEnabled !== undefined || body.yearlyDiscountPercent !== undefined)) throw fieldError({ prices: 'not_allowed' })

  const replaced = []
  if (paid) {
    const rows = nextPrices(plan, body)
    const { value } = await AppConfig.findOne({ key: 'stripe' }).lean()
    const productId = value.productIds[key]
    const created = []
    // An unchanged amount keeps its Price; a changed one gets a new Price (Prices cannot change).
    const priceOf = async (interval, currency, amountMinor, current) => {
      if (current?.amountMinor === amountMinor && current.stripePriceId) return current.stripePriceId
      const price = await callStripe(() => createPrice(productId, { planKey: key, interval, currency, amountMinor }))
      created.push(price.id)
      if (current?.stripePriceId) replaced.push(current.stripePriceId)
      return price.id
    }
    try {
      const prices = []
      const yearlyPrices = []
      for (const row of rows) {
        const monthly = plan.prices.find((price) => price.currency === row.currency)
        const yearly = plan.yearlyPrices.find((price) => price.currency === row.currency)
        prices.push({ currency: row.currency, amountMinor: row.monthlyMinor, stripePriceId: await priceOf('month', row.currency, row.monthlyMinor, monthly) })
        yearlyPrices.push({
          currency: row.currency,
          amountMinor: row.yearlyMinor,
          override: row.override,
          stripePriceId: await priceOf('year', row.currency, row.yearlyMinor, yearly),
        })
      }
      plan.set({ prices, yearlyPrices, yearlyEnabled: body.yearlyEnabled ?? plan.yearlyEnabled, yearlyDiscountPercent: body.yearlyDiscountPercent ?? plan.yearlyDiscountPercent })
      // The Portal offers the new Prices for monthly ↔ yearly switches.
      await callStripe(() => ensurePortalConfiguration(plan, productId))
      // Checkout shows the Product's name.
      if (body.name.en !== plan.name.en) await callStripe((s) => s.products.update(productId, { name: body.name.en }))
    } catch (error) {
      await archivePrices(created)
      throw error
    }
  }
  plan.set({ name: body.name, features: body.features })
  await plan.save()
  await archivePrices(replaced)
  await recordAudit({
    type: 'payments.plan_updated',
    category: 'payments',
    actor: actorFor(admin),
    target: { type: 'plan', id: plan._id },
    params: { plan: plan.name[admin.language] ?? plan.name.en },
  })
  return planDto(plan.toObject(), await paidSubscriptions())
}
