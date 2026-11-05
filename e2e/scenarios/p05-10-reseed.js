import { signInWithForm } from '../lib/flows.js'
import { seedTestDatabase } from '../lib/stack.js'
import { stripe, stripeCustomerOf, TEST_DB, until } from '../lib/payments.js'
import { db } from '../lib/testApi.js'

/**
 * P5-10 (OD8, P5-Q3, P11c-Q11): seed:demo twice → Stripe has exactly the two seed customers for eujobs_test (searched
 * by metadata): Emma (Plus) and Sarah (Recruiter Plus); Emma shows Plus. Re-seeding wipes the test database, so this
 * runs last in phase 5.
 */
export default {
  name: 'P5-10 Re-seed',
  viewports: ['D'],
  async run(ctx) {
    seedTestDatabase()
    seedTestDatabase()
    const [emma] = await db('users', 'find', { filter: { email: ctx.seedCredentials.email('emma') } })
    const [sarah] = await db('users', 'find', { filter: { email: ctx.seedCredentials.email('sarah') } })
    const expected = [await stripeCustomerOf(emma._id.$oid), await stripeCustomerOf(sarah._id.$oid)].sort().join()
    // Stripe's search index lags behind by up to a minute.
    const found = await until(
      async () => (await stripe.customers.search({ query: `metadata['db']:'${TEST_DB}' AND metadata['seed']:'true'`, limit: 100 })).data.map((customer) => customer.id),
      (ids) => [...ids].sort().join() === expected,
      { timeout: 180_000, label: 'exactly the two seed customers' },
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
