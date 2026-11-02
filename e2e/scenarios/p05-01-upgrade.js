import { waitForText } from '../lib/flows.js'
import { continueToStripe, freeCandidate, meOf, openAs, openUpgrade, payOnCheckout, rowsOf, stripe, stripeCustomerOf, until } from '../lib/payments.js'

/**
 * P5-01 (M-118, M-124, M-125, M-126, M-130, C13, U40): a Free candidate in Poland opens AI insights, sees the gate in
 * PLN, confirms, pays on Stripe's hosted Checkout with 4242 and comes back to AI insights unlocked. One paid LWM- row
 * with a receipt link; Billing shows PLN and the renewal date.
 */
export default {
  name: 'P5-01 Upgrade',
  viewports: ['D', 'M'],
  async run(ctx) {
    const { email, token, user } = await freeCandidate('Upgrade', 'PL')
    const handle = await ctx.newPage()
    const { page } = handle
    await openAs(ctx, handle, email, '/candidate/ai-insights')

    const price = new Intl.NumberFormat('en-PL', { style: 'currency', currency: 'PLN', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(45)
    const gate = await page.$eval('[data-plan-gate="ai"]', (element) => element.innerText)
    ctx.check(gate.includes(price), `the gate shows the Plus price ${price} (got: ${gate.slice(0, 80)})`)
    await handle.checkOverflow()
    await ctx.screenshot(page, '1-gate')

    const summary = await openUpgrade(page, 'Upgrade to Plus')
    ctx.check(summary.includes('Plus') && summary.includes(price) && summary.includes('PLN'), `confirm dialog: item, price and currency (${summary})`)
    await waitForText(page, 'Continue to secure payment')
    await handle.checkOverflow()
    await ctx.screenshot(page, '2-confirm')

    const checkout = await continueToStripe(page, 'PLN 45.00')
    ctx.check(checkout.lang.startsWith('en'), `Checkout in the user's language (${checkout.lang})`)
    const [session] = (await stripe.checkout.sessions.list({ customer: await stripeCustomerOf(user.id), limit: 1 })).data
    ctx.check(JSON.stringify(session.payment_method_types) === '["card","link"]', `card and Link only (${session.payment_method_types})`)
    ctx.check(session.adaptive_pricing?.enabled === false, 'Adaptive Pricing off')
    await ctx.screenshot(page, '3-stripe-checkout')

    await payOnCheckout(page)
    await ctx.screenshot(page, '4-return')
    await page.waitForFunction(() => location.pathname === '/candidate/ai-insights' && !document.querySelector('[data-plan-gate]') && document.querySelector('main h1'), {
      timeout: 90_000,
    })
    await ctx.screenshot(page, '5-unlocked')
    ctx.check((await meOf(token)).plan === 'plus', '/me says Plus')

    const [subscription] = await rowsOf('subscriptions', user.id)
    ctx.check(subscription?.status === 'active' && subscription.currency === 'PLN', 'an active PLN subscription is stored')
    const payments = await until(() => rowsOf('payments', user.id), (rows) => rows.length === 1, { label: 'one payment row' })
    const [row] = payments
    ctx.check(/^LWM-\d{6}$/.test(row.reference) && row.status === 'paid' && row.amountMinor === 4500 && row.receiptUrl, 'one paid LWM- row with a receipt link')

    await page.goto(`${ctx.webUrl}/candidate/settings/billing`, { waitUntil: 'networkidle0' })
    await page.waitForSelector('[data-billing-state="active"]')
    const billing = await page.$eval('main', (main) => main.innerText)
    ctx.check(billing.includes(price) && billing.includes('Renews on') && billing.includes(row.reference), 'Billing: PLN price, renewal date and the payment')
    ctx.check(await page.$(`a[href="${row.receiptUrl}"]`), 'the row links to the Stripe invoice')
    await handle.checkOverflow()
    await ctx.screenshot(page, '6-billing')
    ctx.assertClean(handle.issues, 'upgrade')
  },
}

