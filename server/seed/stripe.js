import { stripe } from '../lib/stripe.js'

/*
 * Stripe catalogue objects for seed:catalog (U40, P6). They are shared by every database of the app (the
 * development and test databases use one sandbox), so each is found again instead of created twice:
 * Prices by lookup key, the Product through those Prices (or its metadata), the Portal configuration by metadata.
 */
const APP = { app: 'localworkman' }

// P6: cancel at period end, card updates and invoice history; no plan switching and no customer edits.
const PORTAL_FEATURES = {
  customer_update: { enabled: false },
  invoice_history: { enabled: true },
  payment_method_update: { enabled: true },
  subscription_cancel: { enabled: true, mode: 'at_period_end' },
  subscription_update: { enabled: false },
}

// e.g. plus_monthly_gbp, recruiter_plus_monthly_eur.
const lookupKeyOf = (planKey, currency) => `${planKey}_monthly_${currency.toLowerCase()}`

async function findProduct(planKey) {
  for await (const product of stripe().products.list({ active: true, limit: 100 })) {
    if (product.metadata.app === APP.app && product.metadata.plan === planKey) return product.id
  }
  return null
}

/** P6: one Portal configuration for both plans (§3.22). */
export async function ensurePortalConfiguration() {
  for await (const configuration of stripe().billingPortal.configurations.list({ limit: 100 })) {
    if (configuration.metadata?.app === APP.app) {
      await stripe().billingPortal.configurations.update(configuration.id, { active: true, features: PORTAL_FEATURES })
      return configuration.id
    }
  }
  return (await stripe().billingPortal.configurations.create({ features: PORTAL_FEATURES, metadata: APP })).id
}

/**
 * A paid plan's Product (Plus, Recruiter Plus) and one monthly Price per currency (`prices` in minor units).
 * A changed amount gets a new Price that takes over the lookup key (Prices are immutable).
 */
export async function ensurePlanPrices({ key, name, prices }) {
  const { data: existing } = await stripe().prices.list({ lookup_keys: prices.map((price) => lookupKeyOf(key, price.currency)), active: true, limit: 10 })
  const productId =
    existing[0]?.product ?? (await findProduct(key)) ?? (await stripe().products.create({ name: name.en, metadata: { ...APP, plan: key } })).id
  const priceIds = {}
  for (const { currency, amountMinor } of prices) {
    const lookupKey = lookupKeyOf(key, currency)
    const found = existing.find((price) => price.lookup_key === lookupKey)
    const current = found && found.product === productId && found.unit_amount === amountMinor && found.recurring?.interval === 'month'
    priceIds[currency] = current
      ? found.id
      : (
          await stripe().prices.create({
            product: productId,
            currency: currency.toLowerCase(),
            unit_amount: amountMinor,
            recurring: { interval: 'month' },
            lookup_key: lookupKey,
            transfer_lookup_key: true,
            metadata: APP,
          })
        ).id
  }
  return { productId, priceIds }
}

/**
 * P5-Q3, OD8: seed:demo wipes every user of its database, so it deletes their Stripe customers (which cancels their
 * subscriptions) and the e2e test clocks named for that database. `knownIds` are the customer ids still stored on
 * users (search results can lag a minute behind).
 */
export async function deleteDatabaseCustomers(dbName, knownIds) {
  const ids = new Set(knownIds)
  for await (const customer of stripe().customers.search({ query: `metadata['db']:'${dbName}'`, limit: 100 })) ids.add(customer.id)
  await Promise.all(
    [...ids].map((id) =>
      stripe()
        .customers.del(id)
        .catch((error) => {
          if (error.code !== 'resource_missing') throw error
        }),
    ),
  )
  for await (const clock of stripe().testHelpers.testClocks.list({ limit: 100 })) {
    if (clock.name?.startsWith(`localworkman ${dbName}`)) await stripe().testHelpers.testClocks.del(clock.id)
  }
}
