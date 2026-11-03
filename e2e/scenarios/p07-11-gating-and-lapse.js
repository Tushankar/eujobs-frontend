import { completeCandidate, recruiterWithJob, tickIn } from '../lib/applicants.js'
import { signInWithForm, waitForText } from '../lib/flows.js'
import { alertsOf, createAlertApi } from '../lib/messages.js'
import { stripe, subscribeThroughApi, waitForPlan } from '../lib/payments.js'
import { db, mailTo, TEST_PASSWORD } from '../lib/testApi.js'

/**
 * P7-11 (M-118, M-119, P7-Q2): Alex (Free, no alerts) finds Job alerts locked with the chip and the gate. A lapsed
 * Plus candidate sees their alert "Paused" with the upgrade notice and gets no email; after re-subscribing the
 * alert is active again and delivery resumes.
 */
export default {
  name: 'P7-11 Gating and lapse',
  viewports: ['D'],
  async run(ctx) {
    const alex = await ctx.newPage()
    await signInWithForm(alex.page, ctx.webUrl, '/sign-in', ctx.seedCredentials.email('alex'), ctx.seedCredentials.password)
    await alex.page.goto(`${ctx.webUrl}/candidate/job-alerts`, { waitUntil: 'networkidle0' })
    await alex.page.waitForSelector('[data-plan-gate="job_alerts"]', { visible: true })
    ctx.check(Boolean(await alex.page.$('#workspace-sidebar nav a[href="/candidate/job-alerts"] [data-plan-chip]')), 'the sidebar shows the plan chip')
    await ctx.screenshot(alex.page, '1-free-gate')
    ctx.assertClean(alex.issues, 'free gate')

    const tag = `lapse${Date.now() % 100000}`
    const user = await completeCandidate('Lapsed')
    const alert = await createAlertApi(user.token, { name: 'Lapse check', keywords: tag })
    const [subscription] = await db('subscriptions', 'find', { filter: { userId: { $oid: user.id } } })
    await stripe.subscriptions.cancel(subscription.stripeSubscriptionId)
    await waitForPlan(user.token, 'free')
    ctx.check((await alertsOf(user.token)).planPaused === true, 'the API reports the alerts paused')

    const handle = await ctx.newPage()
    const { page } = handle
    await signInWithForm(page, ctx.webUrl, '/sign-in', user.email, TEST_PASSWORD)
    await page.goto(`${ctx.webUrl}/candidate/job-alerts`, { waitUntil: 'networkidle0' })
    await page.waitForSelector('[data-alerts-paused]', { visible: true })
    ctx.check((await page.$eval(`[data-alert="${alert.id}"]`, (card) => card.innerText)).includes('Paused'), 'the alert card reads Paused')
    ctx.check(!(await page.$('[data-create-alert]')), 'no create button while paused')
    await ctx.screenshot(page, '2-paused')

    await recruiterWithJob('LapseOne', { title: `Designer ${tag}` })
    await tickIn(0)
    ctx.check((await mailTo(user.email, 'alert_instant')).length === 0, 'no alert email while lapsed')

    await subscribeThroughApi(user)
    await waitForPlan(user.token, 'plus')
    await page.reload({ waitUntil: 'networkidle0' })
    await waitForText(page, 'Active')
    ctx.check(!(await page.$('[data-alerts-paused]')), 'the paused notice is gone after re-subscribing')
    await ctx.screenshot(page, '3-resumed')
    await recruiterWithJob('LapseTwo', { title: `Researcher ${tag}` })
    await tickIn(0)
    const mails = await mailTo(user.email, 'alert_instant')
    ctx.check(mails.length === 1 && mails[0].params.job === `Researcher ${tag}`, `delivery resumes with the next job (${mails.map((mail) => mail.params.job)})`)
    ctx.assertClean(handle.issues, 'lapse')
  },
}
