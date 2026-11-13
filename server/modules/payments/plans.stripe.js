import { config } from '../../config/env.js'
import { stripe } from '../../lib/stripe.js'
import { AppConfig, Plan } from './payments.model.js'

/*
 * Plan prices and the Customer Portal in Stripe (U40, P6; yearly billing 2026-11-13). Products and the seed's Prices
 * are shared by every database of the app (one sandbox), so they are found again by lookup key or metadata. Prices an
 * admin creates and the Portal configurations carry this database's name, because their ids differ per database.
 */
export const APP = { app: 'localworkman' }

/** 2026-11-13: 12 months less `percent`, rounded to whole units (tens from 1,000 up), in minor units. */
export function yearlyAmount(monthlyMinor, percent) {
  const major = (monthlyMinor * 12 * (100 - percent)) / 100 / 100
  return (major >= 1000 ? Math.round(major / 10) * 10 : Math.round(major)) * 100
}

/** What a year costs less than 12 months, in whole percent. */
export const savingPercent = (monthlyMinor, yearlyMinor) => Math.round((1 - yearlyMinor / (monthlyMinor * 12)) * 100)

/** A recurring Price of the plan's Product; admin prices are tagged with this database (`db`). */
export function createPrice(productId, { planKey, interval, currency, amountMinor, lookupKey }) {
  return stripe().prices.create({
    product: productId,
    currency: currency.toLowerCase(),
    unit_amount: amountMinor,
    recurring: { interval },
    ...(lookupKey ? { lookup_key: lookupKey, transfer_lookup_key: true, metadata: APP } : { metadata: { ...APP, db: config.dbName, plan: planKey, interval } }),
  })
}

// P6: cancel at period end, card updates and invoice history; no customer edits. Plan switching is set per role below.
const PORTAL_FEATURES = {
  customer_update: { enabled: false },
  invoice_history: { enabled: true },
  payment_method_update: { enabled: true },
  subscription_cancel: { enabled: true, mode: 'at_period_end' },
}

/**
 * 2026-11-13: monthly ↔ yearly in the Portal, among the role's current Prices only (never the other role's plan).
 * A longer interval starts at once and charges the difference; a shorter one waits for the period end.
 */
function portalFeatures(plan, productId) {
  const priceIds = plan.yearlyEnabled ? [...plan.prices, ...plan.yearlyPrices].map((price) => price.stripePriceId) : []
  return {
    ...PORTAL_FEATURES,
    subscription_update: priceIds.length
      ? {
          enabled: true,
          default_allowed_updates: ['price'],
          products: [{ product: productId, prices: priceIds }],
          proration_behavior: 'always_invoice',
          schedule_at_period_end: { conditions: [{ type: 'shortening_interval' }] },
        }
      : { enabled: false },
  }
}

/** One Portal configuration per role in this database, kept in step with the paid plan's Prices; returns its id. */
export async function ensurePortalConfiguration(plan, productId) {
  const features = portalFeatures(plan, productId)
  for await (const configuration of stripe().billingPortal.configurations.list({ limit: 100 })) {
    const { metadata } = configuration
    if (metadata?.app === APP.app && metadata.db === config.dbName && metadata.role === plan.role) {
      await stripe().billingPortal.configurations.update(configuration.id, { active: true, features })
      return configuration.id
    }
  }
  return (await stripe().billingPortal.configurations.create({ features, metadata: { ...APP, db: config.dbName, role: plan.role } })).id
}

/** The paid plans' Portal configurations, stored in AppConfig('stripe') with the Product ids. */
export async function syncPortalConfigurations(productIds) {
  const portalConfigurationIds = {}
  for (const plan of await Plan.find({ key: { $in: Object.keys(productIds) } })) {
    portalConfigurationIds[plan.role] = await ensurePortalConfiguration(plan, productIds[plan.key])
  }
  await AppConfig.updateOne({ key: 'stripe' }, { $set: { value: { productIds, portalConfigurationIds } } }, { upsert: true })
  return portalConfigurationIds
}
