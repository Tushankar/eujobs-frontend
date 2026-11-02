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

export const plusLookupKey = (currency) => `plus_monthly_${currency.toLowerCase()}`

async function findProduct() {
  for await (const product of stripe().products.list({ active: true, limit: 100 })) {
    if (product.metadata.app === APP.app && product.metadata.plan === 'plus') return product.id
  }
  return null
}

async function ensurePortalConfiguration() {
  for await (const configuration of stripe().billingPortal.configurations.list({ limit: 100 })) {
    if (configuration.metadata?.app === APP.app) {
      await stripe().billingPortal.configurations.update(configuration.id, { active: true, features: PORTAL_FEATURES })
      return configuration.id
    }
  }
  return (await stripe().billingPortal.configurations.create({ features: PORTAL_FEATURES, metadata: APP })).id
}

/**
 * The Plus Product, one monthly Price per currency (OD1 `prices` in minor units) and the Portal configuration.
 * A changed amount gets a new Price that takes over the lookup key (Prices are immutable).
 */
export async function ensureStripeCatalog(prices) {
  const { data: existing } = await stripe().prices.list({ lookup_keys: prices.map((price) => plusLookupKey(price.currency)), active: true, limit: 10 })
  const productId =
    existing[0]?.product ?? (await findProduct()) ?? (await stripe().products.create({ name: 'Plus', metadata: { ...APP, plan: 'plus' } })).id
  const priceIds = {}
  for (const { currency, amountMinor } of prices) {
    const lookupKey = plusLookupKey(currency)
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
  return { productId, priceIds, portalConfigurationId: await ensurePortalConfiguration() }
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
