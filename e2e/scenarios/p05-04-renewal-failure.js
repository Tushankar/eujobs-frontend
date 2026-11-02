import { advanceClock, freeCandidate, meOf, openAs, rowsOf, stripe, subscribeThroughApi, TEST_DB, until, waitForPlan } from '../lib/payments.js'
import { mailTo } from '../lib/testApi.js'

const DAY = 24 * 60 * 60

/**
 * P5-04 (M-120, U38, §2.10): a candidate on a Stripe Test Clock pays the first month, then the card switches to 0341.
 * Past the period end the renewal fails: past_due and retrying, still Plus, a failed row, renewal_failed. Through the
 * whole retry schedule the plan ends, whatever the final retry action, with plan_ended, and AI insights lock again.
 */
export default {
  name: 'P5-04 Renewal failure (Test Clock)',
  viewports: ['D'],
  async run(ctx) {
    const { email, token, user } = await freeCandidate('Renewal', 'GB')
    const clock = await stripe.testHelpers.testClocks.create({ frozen_time: Math.floor(Date.now() / 1000), name: `localworkman ${TEST_DB} renewal` })
    const { customer, subscription } = await subscribeThroughApi(user, { testClock: clock.id })
    await waitForPlan(token, 'plus')
    const failing = await stripe.paymentMethods.attach('pm_card_chargeCustomerFail', { customer: customer.id })
    await stripe.customers.update(customer.id, { invoice_settings: { default_payment_method: failing.id } })
    const periodEnd = subscription.items.data[0].current_period_end

    await advanceClock(clock.id, periodEnd + 3600)
    const [failed] = await until(() => rowsOf('payments', user.id, { status: 'failed' }), (rows) => rows.length === 1, { timeout: 120_000, label: 'a failed row' })
    const [mirrored] = await until(() => rowsOf('subscriptions', user.id), ([row]) => row?.status === 'past_due' && row.retrying, { timeout: 120_000, label: 'past_due + retrying' })
    ctx.check(mirrored.retrying, 'past_due while Stripe retries')
    ctx.check((await meOf(token)).plan === 'plus', 'still Plus while Stripe retries')
    ctx.check(failed.kind === 'subscription' && failed.amountMinor === 900, 'the failed renewal is recorded')
    await until(() => mailTo(email, 'renewal_failed'), (mails) => mails.length === 1, { label: 'renewal_failed email' })

    const handle = await ctx.newPage()
    const { page } = handle
    await openAs(ctx, handle, email, '/candidate/settings/billing')
    await page.waitForSelector('[data-billing-state="retrying"]')
    ctx.check(await page.$('[data-payment-status="failed"]'), 'Billing lists the failed payment')
    await ctx.screenshot(page, '1-retrying')

    // Through Stripe's retry schedule, a few days at a time, until the plan ends (at most ~3 weeks: before the next cycle).
    for (const days of [4, 8, 12, 16, 20, 24]) {
      if ((await meOf(token)).plan === 'free') break
      await advanceClock(clock.id, periodEnd + days * DAY)
    }
    await waitForPlan(token, 'free', 120_000)
    const [ended] = await rowsOf('subscriptions', user.id)
    ctx.note(`final Stripe state: ${ended.status}${ended.retrying ? ' (retrying)' : ''}`)
    await until(() => mailTo(email, 'plan_ended'), (mails) => mails.length === 1, { label: 'plan_ended email' })

    await page.goto(`${ctx.webUrl}/candidate/ai-insights`, { waitUntil: 'networkidle0' })
    await page.waitForSelector('[data-plan-gate="ai"]')
    await ctx.screenshot(page, '2-locked')
    ctx.assertClean(handle.issues, 'billing and AI insights')
  },
}
