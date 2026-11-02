import { freeCandidate, openAs, rowsOf, stripe, subscribeThroughApi, until, waitForPlan } from '../lib/payments.js'

/** P5-05 (M-122): a payment refunded through the Stripe API → charge.refunded → the row shows "Refunded" in Billing. */
export default {
  name: 'P5-05 Refund',
  viewports: ['D'],
  async run(ctx) {
    const { email, token, user } = await freeCandidate('Refund', 'GB')
    await subscribeThroughApi(user)
    await waitForPlan(token, 'plus')
    const [row] = await until(() => rowsOf('payments', user.id), (rows) => rows.length === 1, { label: 'the paid row' })
    await stripe.refunds.create({ payment_intent: row.stripe.paymentIntentId })
    await until(() => rowsOf('payments', user.id), ([updated]) => updated.status === 'refunded', { label: 'refunded row' })

    const handle = await ctx.newPage()
    const { page } = handle
    await openAs(ctx, handle, email, '/candidate/settings/billing')
    await page.waitForSelector('[data-payment-status="refunded"]')
    const status = await page.$eval('[data-payment-status="refunded"]', (element) => element.innerText)
    ctx.check(status.includes('Refunded'), `the row shows "Refunded" (${status})`)
    await ctx.screenshot(page, '1-refunded')
    ctx.assertClean(handle.issues, 'billing')
  },
}
