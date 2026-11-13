import { openAsAdmin } from '../lib/admins.js'
import { bodyText, clickText, setValue, waitForText } from '../lib/flows.js'
import { continueToStripe, freeCandidate, meOf, openAs, payOnCheckout, rowsOf, until } from '../lib/payments.js'
import { mailTo } from '../lib/testApi.js'

/** Waits until Billing, reloaded, shows `selector` (webhooks are asynchronous). */
async function billingShows(page, selector, label) {
  await until(
    async () => {
      await page.reload({ waitUntil: 'networkidle0' })
      return page.$(selector)
    },
    Boolean,
    { label },
  )
}

/**
 * P13-01 (owner, 2026-11-13): yearly billing and admin-managed prices. A Free candidate in Germany picks Yearly in
 * Billing (€8.50 a month, €102 billed yearly, the 12-month price struck through), confirms the yearly period in the
 * dialog, pays on Stripe's hosted Checkout and gets the welcome email; Billing shows €102 per year. In the Portal they
 * switch to monthly, which waits for the period end: Billing says so and the scheduled-change email arrives. Then they
 * cancel in the Portal: the cancellation email names the end date. On desktop, the owner raises the EUR monthly price
 * in Payments › Plans: /pricing shows it at once, the subscriber keeps €102, and the price is set back.
 */
export default {
  name: 'P13-01 Yearly plan and admin prices',
  viewports: ['D', 'M'],
  async run(ctx) {
    const { email, token, user } = await freeCandidate(`Yearly${ctx.viewport}`, 'DE')
    const handle = await ctx.newPage()
    const { page } = handle
    await openAs(ctx, handle, email, '/candidate/settings/billing')

    // Billing: Monthly / Yearly; yearly shows the monthly share, the yearly total and the struck 12-month price.
    await page.click('[data-interval="year"]')
    await page.waitForSelector('[data-plan="plus"] [data-plan-price="year"]')
    const card = await page.$eval('[data-plan="plus"]', (element) => element.innerText.replace(/\s/g, ' '))
    ctx.check(card.includes('€8.50') && card.includes('€102 billed yearly') && card.includes('€120'), `Plus yearly: €8.50 / month, €102 billed yearly, €120 struck (${card.slice(0, 120)})`)
    await handle.checkOverflow()
    await ctx.screenshot(page, '1-billing-yearly')

    // The dialog starts on Yearly and quotes the server's yearly price; Monthly is one click away.
    await clickText(page, 'Upgrade to Plus', 'main button')
    await page.waitForSelector('[data-checkout-interval="year"][aria-checked="true"]', { visible: true })
    await waitForText(page, 'Billed yearly in EUR')
    let summary = await page.$eval('[data-checkout-summary]', (element) => element.innerText)
    ctx.check(summary.includes('€102'), `the summary quotes €102 a year (${summary})`)
    await page.click('[data-checkout-interval="month"]')
    await waitForText(page, 'Billed monthly in EUR')
    await page.click('[data-checkout-interval="year"]')
    await waitForText(page, 'Billed yearly in EUR')
    summary = await page.$eval('[data-checkout-summary]', (element) => element.innerText)
    ctx.check(summary.includes('€102'), 'back on Yearly')
    await handle.checkOverflow()
    await ctx.screenshot(page, '2-confirm-yearly')

    await continueToStripe(page, '102.00')
    await ctx.screenshot(page, '3-stripe-checkout')
    await payOnCheckout(page)
    await page.waitForFunction(() => location.pathname === '/candidate/settings/billing', { timeout: 90_000 })
    await until(() => meOf(token), (me) => me.plan === 'plus', { label: 'plan plus' })
    const [subscription] = await rowsOf('subscriptions', user.id)
    ctx.check(subscription.interval === 'year' && subscription.amountMinor === 10200 && subscription.currency === 'EUR', 'a yearly €102 subscription is stored')
    const [welcome] = await until(() => mailTo(email, 'plan_started'), (mails) => mails.length === 1, { label: 'welcome email' })
    ctx.check(welcome.params.billing === 'yearly' && welcome.params.amount === '€102.00' && welcome.params.secondaryLink, `welcome email: yearly, €102, invoice link (${welcome.subject})`)

    await billingShows(page, '[data-billing-state="active"]', 'Billing active')
    const billing = await bodyText(page)
    ctx.check(billing.includes('€102') && billing.includes('per year') && billing.includes('Renews on'), 'Billing: €102 per year and the renewal date')
    await handle.checkOverflow()
    await ctx.screenshot(page, '4-billing-subscribed')

    // Portal: yearly → monthly waits for the period end.
    await clickText(page, 'Manage subscription', 'main button')
    await page.waitForFunction(() => location.hostname === 'billing.stripe.com', { timeout: 30_000 })
    await page.waitForSelector('a[href*="/update"]', { visible: true, timeout: 30_000 })
    await ctx.screenshot(page, '5-portal')
    await page.click('a[href*="/update"]')
    // "Update your subscription": the Monthly tab, then Continue (Plus is already the selected plan).
    await waitForText(page, 'Update your subscription', 30_000)
    await clickText(page, 'Monthly', 'button, [role="tab"], label')
    await waitForText(page, 'per month')
    await clickText(page, 'Continue', 'button, a, [role="button"]')
    await waitForText(page, 'Confirm', 30_000)
    await ctx.screenshot(page, '6-portal-confirm-monthly')
    await clickText(page, 'Confirm', 'button, a, [role="button"]')
    await page.waitForSelector('[data-testid="return-to-business-link"]', { visible: true, timeout: 30_000 })
    await page.click('[data-testid="return-to-business-link"]')
    await page.waitForFunction(() => location.pathname === '/candidate/settings/billing', { timeout: 30_000 })
    await billingShows(page, '[data-pending-interval="month"]', 'Billing shows the scheduled switch')
    ctx.check((await bodyText(page)).includes('Switches to monthly billing on'), 'Billing: switches to monthly billing on the period end')
    const [scheduled] = await until(() => mailTo(email, 'plan_change_scheduled'), (mails) => mails.length === 1, { label: 'scheduled change email' })
    ctx.check(scheduled.params.billing === 'monthly' && scheduled.params.amount === '€10.00', `scheduled change email: monthly at €10 (${scheduled.subject})`)
    await handle.checkOverflow()
    await ctx.screenshot(page, '7-billing-switch-scheduled')

    // Portal: cancel at period end → the cancellation email.
    await clickText(page, 'Manage subscription', 'main button')
    await page.waitForFunction(() => location.hostname === 'billing.stripe.com', { timeout: 30_000 })
    await page.waitForSelector('a[href*="/cancel"]', { visible: true, timeout: 30_000 })
    await page.click('a[href*="/cancel"]')
    await page.waitForSelector('[data-testid="confirm"]', { visible: true })
    await page.click('[data-testid="confirm"]')
    await page.waitForSelector('[data-testid="return-to-business-link"]', { visible: true, timeout: 30_000 })
    await page.click('[data-testid="return-to-business-link"]')
    await page.waitForFunction(() => location.pathname === '/candidate/settings/billing', { timeout: 30_000 })
    await billingShows(page, '[data-billing-state="ending"]', 'Billing shows the end date')
    const [cancelled] = await until(() => mailTo(email, 'plan_cancel_scheduled'), (mails) => mails.length === 1, { label: 'cancellation email' })
    ctx.check(cancelled.subject.startsWith('Your Plus plan ends on'), `cancellation email (${cancelled.subject})`)
    await ctx.screenshot(page, '8-billing-ending')
    ctx.assertClean(handle.issues, 'yearly plan')

    if (ctx.viewport !== 'D') return
    // The owner raises Plus in EUR from €10 to €11 a month; new visitors see it, the subscriber keeps €102.
    const admin = await ctx.newPage()
    await openAsAdmin(ctx, admin, ctx.seedCredentials.email(), '/admin/payments/plans', ctx.seedCredentials.password)
    const setEuro = async (amount) => {
      await admin.page.click('[data-admin-plan="plus"] button')
      await admin.page.waitForSelector('[data-price-row="EUR"] input', { visible: true })
      await setValue(admin.page, '[data-price-row="EUR"] td:nth-of-type(1) input', amount)
      await clickText(admin.page, 'Save changes', '[role="dialog"] button')
      await waitForText(admin.page, 'Plus saved.')
    }
    await setEuro('11')
    await admin.checkOverflow()
    await ctx.screenshot(admin.page, '9-admin-plans')
    // A signed-out visitor (EUR, the default currency).
    await admin.page.evaluate(() => localStorage.removeItem('lwm-auth-token'))
    await admin.page.goto(`${ctx.webUrl}/pricing`, { waitUntil: 'networkidle0' })
    await waitForText(admin.page, '€11')
    await admin.page.click('[data-interval="year"]')
    await waitForText(admin.page, '€112 billed yearly')
    await ctx.screenshot(admin.page, '10-pricing-new-price')
    ctx.check((await rowsOf('subscriptions', user.id))[0].amountMinor === 10200, 'the subscriber keeps €102')
    await openAsAdmin(ctx, admin, ctx.seedCredentials.email(), '/admin/payments/plans', ctx.seedCredentials.password)
    await setEuro('10')
    ctx.assertClean(admin.issues, 'admin plans')
  },
}
