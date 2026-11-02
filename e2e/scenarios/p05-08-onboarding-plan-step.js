import { PLACES } from '../../server/seed/data/places.js'
import { clickText, signInWithForm, waitForPath } from '../lib/flows.js'
import { meOf, rowsOf, subscribeThroughApi, waitForPlan } from '../lib/payments.js'
import { api, TEST_PASSWORD, uniqueEmail, verifiedCandidate } from '../lib/testApi.js'

/** P5-08 (M-129): a subscriber still in onboarding sees "You're on Plus" on the plan step; Continue does not cancel. */
export default {
  name: 'P5-08 Onboarding plan step',
  viewports: ['D'],
  async run(ctx) {
    const email = uniqueEmail('onplan')
    await verifiedCandidate(email, TEST_PASSWORD, { fullName: `Onplan ${Date.now() % 100000}` })
    const { body } = await api('/auth/login', { method: 'POST', body: { email, password: TEST_PASSWORD, portal: 'candidate' } })
    await api('/candidate/onboarding/preferences', { method: 'PUT', token: body.token, body: { workPreference: 'remote', placeId: PLACES.london.placeId } })
    const me = await meOf(body.token)
    await subscribeThroughApi(me)
    await waitForPlan(body.token, 'plus')

    const handle = await ctx.newPage()
    const { page } = handle
    await signInWithForm(page, ctx.webUrl, '/sign-in', email, TEST_PASSWORD)
    await page.goto(`${ctx.webUrl}/candidate/onboarding/plan`, { waitUntil: 'networkidle0' })
    await page.waitForSelector('[data-on-plan]')
    const panel = await page.$eval('[data-on-plan]', (element) => element.innerText)
    ctx.check(panel.includes('You’re on Plus'), `"You're on Plus" (${panel})`)
    ctx.check(!(await page.$('#plan-free')), 'no "Continue with Free" card for a subscriber')
    await ctx.screenshot(page, '1-on-plus')

    await clickText(page, 'Continue', '[data-on-plan] button')
    await waitForPath(page, () => location.pathname === '/candidate')
    const after = await meOf(body.token)
    ctx.check(after.onboardingCompleted && after.plan === 'plus', 'onboarding done and still Plus')
    const [subscription] = await rowsOf('subscriptions', me.id)
    ctx.check(subscription.status === 'active' && !subscription.cancelAtPeriodEnd, 'the subscription is untouched')
    await ctx.screenshot(page, '2-overview')
    ctx.assertClean(handle.issues, 'plan step')
  },
}
