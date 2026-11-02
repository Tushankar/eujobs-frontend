import { continueToStripe, freeCandidate, openAs, openUpgrade, payOnCheckout, rowsOf, stripe, stripeCustomerOf, until } from '../lib/payments.js'

// OD1 plan prices per header country (Remote pays in EUR, M-130).
const CASES = [
  ['DE', 'EUR', 1000],
  ['GB', 'GBP', 900],
  ['SE', 'SEK', 11900],
  ['DK', 'DKK', 7900],
  ['CZ', 'CZK', 25900],
  ['HU', 'HUF', 399000],
  ['RO', 'RON', 5500],
  ['REMOTE', 'EUR', 1000],
]

/**
 * P5-02 (C14, P5): a fresh Free candidate per country subscribes from Billing through hosted Checkout. Each Checkout
 * session and each stored row has the requested currency and the OD1 amount.
 */
export default {
  name: 'P5-02 Every currency',
  viewports: ['D'],
  async run(ctx) {
    for (const [country, currency, amountMinor] of CASES) {
      const { email, user } = await freeCandidate(`Currency${country}`, country)
      const handle = await ctx.newPage()
      const { page } = handle
      await openAs(ctx, handle, email, '/candidate/settings/billing')
      await page.waitForSelector('[data-billing-state="free"]')
      const summary = await openUpgrade(page, 'Upgrade to Plus')
      ctx.check(summary.includes(`Billed monthly in ${currency}`), `${country}: confirm step in ${currency} (${summary})`)

      await continueToStripe(page, 'Subscribe to Plus')
      const [session] = (await stripe.checkout.sessions.list({ customer: await stripeCustomerOf(user.id), limit: 1 })).data
      ctx.check(session.currency === currency.toLowerCase() && session.amount_total === amountMinor, `${country}: Checkout ${session.currency} ${session.amount_total}`)
      await ctx.screenshot(page, `${country}-checkout`)

      await payOnCheckout(page)
      await page.waitForSelector('[data-billing-state="active"]', { timeout: 90_000 })
      const [row] = await until(() => rowsOf('payments', user.id), (rows) => rows.length === 1, { label: `${country} payment row` })
      ctx.check(row.currency === currency && row.amountMinor === amountMinor && row.status === 'paid', `${country}: stored row ${row.currency} ${row.amountMinor}`)
      await ctx.screenshot(page, `${country}-billing`)
      ctx.assertClean(handle.issues, country)
    }
  },
}
