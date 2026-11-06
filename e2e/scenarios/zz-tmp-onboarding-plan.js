import { PLACES } from '../../server/seed/data/places.js'
import { signInWithForm } from '../lib/flows.js'
import { api, TEST_PASSWORD, uniqueEmail, verifiedCandidate } from '../lib/testApi.js'

/** The redesigned plan step for a Free candidate still in onboarding: Free and Plus cards, Back on the left. */
export default {
  name: 'ZZ Onboarding plan cards',
  viewports: ['D', 'M'],
  async run(ctx) {
    const email = uniqueEmail('plancards')
    await verifiedCandidate(email, TEST_PASSWORD, { fullName: `Plancards ${Date.now() % 100000}` })
    const { body } = await api('/auth/login', { method: 'POST', body: { email, password: TEST_PASSWORD, portal: 'candidate' } })
    await api('/candidate/onboarding/preferences', { method: 'PUT', token: body.token, body: { workPreference: 'hybrid', placeId: PLACES.london.placeId } })

    const handle = await ctx.newPage()
    const { page } = handle
    await signInWithForm(page, ctx.webUrl, '/sign-in', email, TEST_PASSWORD)
    await page.goto(`${ctx.webUrl}/candidate/onboarding/plan`, { waitUntil: 'networkidle0' })
    await page.waitForSelector('#plan-free', { visible: true })
    await new Promise((resolve) => setTimeout(resolve, 1200))
    ctx.check(Boolean(await page.$('#plan-plus')), 'the Plus card shows')
    await handle.checkOverflow()
    await ctx.screenshot(page, '1-plan-cards')
    await page.goto(`${ctx.webUrl}/candidate/onboarding/preferences`, { waitUntil: 'networkidle0' })
    await page.waitForSelector('input[name="workPreference"]')
    await new Promise((resolve) => setTimeout(resolve, 1200))
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await new Promise((resolve) => setTimeout(resolve, 300))
    await handle.checkOverflow()
    await ctx.screenshot(page, '2-preferences-actions')
    ctx.assertClean(handle.issues, 'plan')
  },
}
