import { clickApply } from '../lib/applicants.js'
import { clickText, pageApi, signInWithForm } from '../lib/flows.js'
import { stripe, waitForPlan } from '../lib/payments.js'
import { login } from '../lib/recruiters.js'
import { api, db } from '../lib/testApi.js'

/**
 * P6-09 (M-119): Emma's subscription is canceled → her existing application stays active and can be withdrawn;
 * Apply on another job shows the upgrade.
 */
export default {
  name: 'P6-09 Lapse',
  viewports: ['D'],
  async run(ctx) {
    const email = ctx.seedCredentials.email('emma')
    const token = await login(email, 'candidate', ctx.seedCredentials.password)
    const me = (await api('/me', { token })).body
    const [subscription] = await db('subscriptions', 'find', { filter: { userId: { $oid: me.id } } })
    await stripe.subscriptions.cancel(subscription.stripeSubscriptionId)
    await waitForPlan(token, 'free')

    const handle = await ctx.newPage()
    const { page } = handle
    await signInWithForm(page, ctx.webUrl, '/sign-in', email, ctx.seedCredentials.password)
    await page.goto(`${ctx.webUrl}/candidate/applications`, { waitUntil: 'networkidle0' })
    // P11d-Q30: the seeded booking moved Emma's application to Interview.
    const active = (await pageApi(page, '/candidate/applications')).body.items.find((item) => item.status === 'interview')
    ctx.check(Boolean(active), 'the seeded application is still active after the lapse')
    await page.click(`[data-application="${active.id}"]`)
    await clickText(page, 'Withdraw application', '[role="dialog"] button')
    await page.waitForFunction(() => document.querySelector('[role="dialog"]')?.innerText.includes('Withdraw this application?'))
    await clickText(page, 'Withdraw application', '[role="dialog"] button')
    await page.waitForFunction(async (id) => {
      const response = await fetch(`/api/v1/candidate/applications/${id}`, { headers: { Authorization: `Bearer ${localStorage.getItem('lwm-auth-token')}` } })
      return (await response.json()).status === 'withdrawn'
    }, {}, active.id)
    await ctx.screenshot(page, '1-withdrawn-after-lapse')

    const jobs = (await pageApi(page, '/jobs')).body.items.filter((job) => !job.application)
    await page.goto(`${ctx.webUrl}/candidate/jobs/${jobs[0].id}`, { waitUntil: 'networkidle0' })
    await clickApply(page)
    await page.waitForSelector('[data-apply-gate]', { visible: true })
    const missing = await page.$$('[data-missing-item]')
    ctx.check(Boolean(await page.$('[data-plan-required]')) && missing.length === 0, 'Apply elsewhere shows only the upgrade')
    await ctx.screenshot(page, '2-upgrade-gate')
    ctx.assertClean(handle.issues, 'lapse')
  },
}
