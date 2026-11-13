import { stripe } from '../lib/stripe.js'
import { APP, createPrice } from '../modules/payments/plans.stripe.js'

/*
 * Stripe catalogue objects for seed:catalog (U40, P6). They are shared by every database of the app (the
 * development and test databases use one sandbox), so each is found again instead of created twice:
 * Prices by lookup key, the Product through those Prices (or its metadata). The Portal configurations are per
 * database (modules/payments/plans.stripe.js).
 */

// e.g. plus_monthly_gbp, recruiter_plus_yearly_eur.
const lookupKeyOf = (planKey, interval, currency) => `${planKey}_${interval === 'year' ? 'yearly' : 'monthly'}_${currency.toLowerCase()}`

async function findProduct(planKey) {
  for await (const product of stripe().products.list({ active: true, limit: 100 })) {
    if (product.metadata.app === APP.app && product.metadata.plan === planKey) return product.id
  }
  return null
}

/** A paid plan's Product (Plus, Recruiter Plus), found again or created. */
export async function ensureProduct({ key, name }) {
  return (await findProduct(key)) ?? (await stripe().products.create({ name: name.en, metadata: { ...APP, plan: key } })).id
}

/**
 * One Price per currency of `prices` (minor units) at `interval`. A changed amount gets a new Price that takes over the
 * lookup key (Prices are immutable). Returns { currency: priceId }.
 */
export async function ensurePlanPrices(productId, planKey, interval, prices) {
  const { data: existing } = await stripe().prices.list({ lookup_keys: prices.map((price) => lookupKeyOf(planKey, interval, price.currency)), active: true, limit: 10 })
  const priceIds = {}
  for (const { currency, amountMinor } of prices) {
    const lookupKey = lookupKeyOf(planKey, interval, currency)
    const found = existing.find((price) => price.lookup_key === lookupKey)
    const current = found && found.product === productId && found.unit_amount === amountMinor && found.recurring?.interval === interval
    priceIds[currency] = current ? found.id : (await createPrice(productId, { planKey, interval, currency, amountMinor, lookupKey })).id
  }
  return priceIds
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
