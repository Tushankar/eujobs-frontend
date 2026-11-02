import { signInWithForm } from '../lib/flows.js'
import { seedTestDatabase } from '../lib/stack.js'
import { stripe, stripeCustomerOf, TEST_DB, until } from '../lib/payments.js'
import { db } from '../lib/testApi.js'

/**
 * P5-10 (OD8, P5-Q3): seed:demo twice → Stripe has exactly one seed customer for eujobs_test (searched by metadata),
 * and Emma shows Plus. Re-seeding wipes the test database, so this runs last in phase 5.
 */
export default {
  name: 'P5-10 Re-seed',
  viewports: ['D'],
  async run(ctx) {
    seedTestDatabase()
    seedTestDatabase()
    const [emma] = await db('users', 'find', { filter: { email: ctx.seedCredentials.email('emma') } })
    const emmaCustomer = await stripeCustomerOf(emma._id.$oid)
    // Stripe's search index lags behind by up to a minute.
    const found = await until(
      async () => (await stripe.customers.search({ query: `metadata['db']:'${TEST_DB}' AND metadata['seed']:'true'`, limit: 100 })).data.map((customer) => customer.id),
      (ids) => ids.length === 1 && ids[0] === emmaCustomer,
      { timeout: 180_000, label: 'exactly one seed customer' },
    )
    ctx.note(`seed customers for ${TEST_DB}: ${found.length}`)

    const handle = await ctx.newPage()
    const { page } = handle
    await signInWithForm(page, ctx.webUrl, '/sign-in', ctx.seedCredentials.email('emma'), ctx.seedCredentials.password)
    await page.goto(`${ctx.webUrl}/candidate/settings/billing`, { waitUntil: 'networkidle0' })
    await page.waitForSelector('[data-billing-state="active"]')
    await ctx.screenshot(page, '1-emma-plus')
    ctx.assertClean(handle.issues, 'Emma billing')
  },
}
