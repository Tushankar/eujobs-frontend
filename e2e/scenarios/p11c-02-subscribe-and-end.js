import { openAsAdmin } from '../lib/admins.js'
import { clickText, waitForText } from '../lib/flows.js'
import { clickNotification, openBell } from '../lib/notifications.js'
import { advanceClock, continueToStripe, meOf, payOnCheckout, rowsOf, stripe, TEST_DB, until, waitForPlan } from '../lib/payments.js'
import { approvedRecruiter, jobBody, postJob } from '../lib/recruiters.js'
import { signInRecruiter, trackRequests } from '../lib/recruiterPlan.js'
import { api, db, mailTo } from '../lib/testApi.js'

const jobsOf = async (token) => (await api('/recruiter/jobs', { token })).body.items

/** Manage → Publish job for `title` on the Jobs page. */
async function publishFromTable(page, title) {
  await page.click(`button[aria-label="Manage ${title}"]`)
  await clickText(page, 'Publish job', 'button')
}

/**
 * P11c-02 (§3.22, P11c-Q2, Q5 … Q8, Q13, Q18): a Free recruiter whose company is in Berlin publishes a 2nd job → the
 * upgrade dialog → hosted Checkout in EUR (57.00, the £49 row) → pays with 4242 → the webhook arrives and the locks
 * lift: two more jobs go live, Find candidates searches, Shortlists opens. Billing shows Recruiter Plus and the
 * invoice; admin Payments lists the row and counts the recruiter. Then Billing → Portal → cancel; past the period end
 * (Stripe Test Clock) the plan ends: only the most recently published job stays live, the other two are paused, and
 * the notification and email name them.
 */
export default {
  name: 'P11c-02 Recruiter Plus: subscribe, cancel, plan end',
  viewports: ['D', 'M'],
  async run(ctx) {
    const label = `RecPlus${ctx.viewport}`
    const recruiter = await approvedRecruiter(label, { plus: false, city: 'berlin' })
    const me = await meOf(recruiter.token)
    // Checkout uses this customer, on a Test Clock so the period end can be reached (as P5-04).
    const clock = await stripe.testHelpers.testClocks.create({ frozen_time: Math.floor(Date.now() / 1000), name: `localworkman ${TEST_DB} recruiter ${ctx.viewport}` })
    const customer = await stripe.customers.create({ email: recruiter.email, name: me.fullName, metadata: { db: TEST_DB, userId: me.id }, test_clock: clock.id })
    await db('users', 'updateMany', { filter: { _id: { $oid: me.id } }, update: { $set: { stripeCustomerId: customer.id } } })
    const first = await postJob(recruiter.token, jobBody({ title: `${label} First`, city: 'berlin' }))
    const second = await postJob(recruiter.token, jobBody({ title: `${label} Second`, city: 'berlin' }), { draft: true })
    const third = await postJob(recruiter.token, jobBody({ title: `${label} Third`, city: 'berlin' }), { draft: true })

    const handle = await ctx.newPage()
    const { page } = handle
    const requests = trackRequests(page)
    await signInRecruiter(ctx, page, recruiter.email, '/recruiter/jobs')

    // Publishing the 2nd job opens the upgrade dialog (no request), then Stripe in the company country's currency.
    requests.mark()
    await publishFromTable(page, second.title)
    await page.waitForSelector('[role="dialog"] [data-checkout-summary]', { visible: true })
    const summary = await page.$eval('[role="dialog"]', (dialog) => dialog.innerText)
    ctx.check(summary.includes('Recruiter Plus') && summary.includes('57') && summary.includes('EUR'), `the dialog: Recruiter Plus, 57, EUR (${summary.replace(/\n/g, ' ').slice(0, 160)})`)
    ctx.check(!requests.since().some((request) => request.includes('/status')), 'no publish request was sent')
    await handle.checkOverflow()
    await ctx.screenshot(page, '1-upgrade')
    const checkout = await continueToStripe(page, '57.00')
    ctx.check(checkout.text.includes('Recruiter Plus'), 'Checkout names Recruiter Plus')
    await page.waitForSelector('#cardNumber', { visible: true })
    await new Promise((resolve) => setTimeout(resolve, 1500))
    await ctx.screenshot(page, '2-checkout')
    await payOnCheckout(page)
    await page.waitForFunction(() => location.pathname === '/recruiter/jobs', { timeout: 90_000 })
    await waitForPlan(recruiter.token, 'recruiter_plus', 90_000)
    const [subscription] = await rowsOf('subscriptions', me.id)
    ctx.check(subscription.planKey === 'recruiter_plus' && subscription.currency === 'EUR' && subscription.amountMinor === 5700, 'an active EUR Recruiter Plus subscription')
    const [payment] = await until(() => rowsOf('payments', me.id), (rows) => rows.length === 1, { label: 'one payment row' })
    ctx.check(payment.payerRole === 'recruiter' && payment.itemId === 'recruiter_plus' && payment.status === 'paid' && payment.amountMinor === 5700, 'one paid Recruiter Plus row')

    // The locks lift: two more jobs go live, Find candidates searches, Shortlists opens.
    await page.reload({ waitUntil: 'networkidle0' })
    ctx.check(!(await page.$('main [data-plan-locked]')), 'no locks on Jobs')
    for (const job of [third, second]) {
      await publishFromTable(page, job.title)
      await until(() => jobsOf(recruiter.token), (jobs) => jobs.find((item) => item.id === job.id)?.status === 'published', { label: `${job.title} live` })
      await page.reload({ waitUntil: 'networkidle0' })
    }
    await ctx.screenshot(page, '3-three-live')
    await page.goto(`${ctx.webUrl}/recruiter/find-candidates`, { waitUntil: 'networkidle0' })
    ctx.check(await page.$('main input[type="search"]'), 'Find candidates searches')
    await page.goto(`${ctx.webUrl}/recruiter/shortlists`, { waitUntil: 'networkidle0' })
    ctx.check(!(await page.$('[data-plan-gate]')), 'Shortlists opens')

    // Billing: the plan, its price and renewal, the invoice.
    await page.goto(`${ctx.webUrl}/recruiter/settings/billing`, { waitUntil: 'networkidle0' })
    await page.waitForSelector('[data-billing-state="active"]')
    const billing = await page.$eval('main', (main) => main.innerText)
    ctx.check(billing.includes('Recruiter Plus') && billing.includes('57') && billing.includes('Renews on') && billing.includes(payment.reference), 'Billing: Recruiter Plus, 57, renewal date, the invoice')
    await handle.checkOverflow()
    await ctx.screenshot(page, '4-billing')

    // Admin Payments: the row and the recruiter in the cards.
    const admin = await ctx.newPage()
    await openAsAdmin(ctx, admin, ctx.seedCredentials.email(), `/admin/payments?q=${payment.reference}`, ctx.seedCredentials.password)
    await waitForText(admin.page, payment.reference)
    const adminText = await admin.page.$eval('main', (main) => main.innerText)
    ctx.check(adminText.includes('Recruiter Plus'), 'admin Payments lists the Recruiter Plus row')
    ctx.check(/Recruiters [1-9]/.test(adminText), 'the cards count recruiter subscribers')
    ctx.check(await admin.page.$('[data-mrr-role="recruiter"]'), 'MRR shows the recruiter line')
    await admin.checkOverflow()
    await ctx.screenshot(admin.page, '5-admin-payments')
    ctx.assertClean(admin.issues, 'admin payments')

    // Portal: cancel at period end, back to Billing "Ends on".
    await clickText(page, 'Manage subscription', 'main button')
    await page.waitForFunction(() => location.hostname === 'billing.stripe.com', { timeout: 30_000 })
    await page.waitForSelector('a[href*="/cancel"]', { visible: true, timeout: 30_000 })
    await page.click('a[href*="/cancel"]')
    await page.waitForSelector('[data-testid="confirm"]', { visible: true })
    await page.click('[data-testid="confirm"]')
    await page.waitForSelector('[data-testid="return-to-business-link"]', { visible: true, timeout: 30_000 })
    await ctx.screenshot(page, '6-portal-cancelled')
    await page.click('[data-testid="return-to-business-link"]')
    await page.waitForFunction(() => location.pathname === '/recruiter/settings/billing', { timeout: 30_000 })
    await until(
      async () => {
        await page.reload({ waitUntil: 'networkidle0' })
        return page.$('[data-billing-state="ending"]')
      },
      Boolean,
      { label: 'Billing shows the end date' },
    )
    ctx.check((await meOf(recruiter.token)).plan === 'recruiter_plus', 'still Recruiter Plus until the period ends')

    // Past the period end the plan ends: the newest job stays live, the other two are paused.
    const [live] = (await stripe.subscriptions.list({ customer: customer.id, status: 'all', limit: 1 })).data
    await advanceClock(clock.id, live.items.data[0].current_period_end + 3600)
    await waitForPlan(recruiter.token, 'free', 120_000)
    const jobs = await until(() => jobsOf(recruiter.token), (items) => items.filter((item) => item.status === 'paused').length === 2, { label: 'two jobs paused' })
    const status = Object.fromEntries(jobs.map((item) => [item.id, item.status]))
    ctx.check(status[second.id] === 'published' && status[first.id] === 'paused' && status[third.id] === 'paused', `the most recently published job stays live (${JSON.stringify(status)})`)
    const [mail] = await until(() => mailTo(recruiter.email, 'recruiter_plan_ended'), (mails) => mails.length === 1, { label: 'plan ended email' })
    ctx.check(mail.params.paused.includes(second.title) && mail.params.paused.includes('2 other jobs were paused'), `the email names the jobs (${mail.params.paused})`)

    await page.goto(`${ctx.webUrl}/recruiter/settings/billing`, { waitUntil: 'networkidle0' })
    await page.waitForSelector('[data-billing-state="free"]')
    await openBell(page)
    await waitForText(page, `${second.title} stays live; 2 other jobs were paused.`)
    await handle.checkOverflow()
    await ctx.screenshot(page, '7-plan-ended')
    const opened = await clickNotification(page, 'plan_ended', '/recruiter/jobs')
    ctx.check(opened.available, 'the notification opens Jobs')
    await page.waitForSelector('main tbody tr')
    // The page's entrance animation leaves fresh blocks transparent for a moment.
    await new Promise((resolve) => setTimeout(resolve, 600))
    await ctx.screenshot(page, '8-jobs-paused')
    ctx.assertClean(handle.issues, 'recruiter plus')
  },
}
