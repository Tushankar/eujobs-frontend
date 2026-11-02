import { freeCandidate, meOf, openAs, subscribeThroughApi, until, waitForPlan } from '../lib/payments.js'
import { clickText } from '../lib/flows.js'

/**
 * P5-03 (M-120, M-121, P6): Billing → Manage subscription opens the Stripe Customer Portal with cancel, card update and
 * invoices and no plan switching. Cancelling at period end and returning shows "Ends on {date}"; still Plus.
 */
export default {
  name: 'P5-03 Portal cancel',
  viewports: ['D'],
  async run(ctx) {
    const { email, token, user } = await freeCandidate('Portal', 'GB')
    await subscribeThroughApi(user)
    await waitForPlan(token, 'plus')
    const handle = await ctx.newPage()
    const { page } = handle
    await openAs(ctx, handle, email, '/candidate/settings/billing')
    await page.waitForSelector('[data-billing-state="active"]')

    await clickText(page, 'Manage subscription', 'main button')
    await page.waitForFunction(() => location.hostname === 'billing.stripe.com', { timeout: 30_000 })
    await page.waitForSelector('a[href*="/cancel"]', { visible: true, timeout: 30_000 })
    const portal = await page.evaluate(() => document.body.innerText)
    ctx.check(portal.includes('Cancel subscription'), 'Portal offers cancellation')
    ctx.check(portal.includes('Add payment method'), 'Portal offers a card update')
    ctx.check(/invoice history/i.test(portal), 'Portal lists invoices')
    ctx.check(!/update (plan|subscription)|change plan/i.test(portal), 'no plan switching')
    await ctx.screenshot(page, '1-portal')

    await page.click('a[href*="/cancel"]')
    await page.waitForSelector('[data-testid="confirm"]', { visible: true })
    await page.click('[data-testid="confirm"]')
    await until(() => meOf(token), (me) => me.plan === 'plus', { label: 'still Plus' })
    await page.waitForSelector('[data-testid="return-to-business-link"]', { visible: true, timeout: 30_000 })
    await ctx.screenshot(page, '2-cancelled')
    await page.click('[data-testid="return-to-business-link"]')

    await page.waitForFunction(() => location.pathname === '/candidate/settings/billing', { timeout: 30_000 })
    // The webhook may land after the return: Billing refreshes on reload.
    await until(
      async () => {
        await page.reload({ waitUntil: 'networkidle0' })
        return page.$('[data-billing-state="ending"]')
      },
      Boolean,
      { label: 'Billing shows the end date' },
    )
    const billing = await page.$eval('main', (main) => main.innerText)
    ctx.check(billing.includes('Ends on'), 'Billing shows "Ends on {date}"')
    ctx.check((await meOf(token)).plan === 'plus', 'still Plus until the period ends')
    await ctx.screenshot(page, '3-billing-ending')
    ctx.assertClean(handle.issues, 'billing')
  },
}
