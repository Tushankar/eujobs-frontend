import { bodyText, clickText, fill } from '../lib/flows.js'
import { api, TEST_PASSWORD, uniqueEmail } from '../lib/testApi.js'

/** P2-02: signing in before the link → alert with Resend; a second Resend within 60 s → the wait time. */
export default {
  name: 'P2-02 Unverified sign-in',
  viewports: ['D'],
  async run(ctx) {
    const email = uniqueEmail('p202')
    await api('/auth/candidate/register', {
      method: 'POST',
      body: { fullName: 'Unverified Person', email, password: TEST_PASSWORD, acceptTerms: true, language: 'en', country: 'IE' },
    })

    const handle = await ctx.newPage()
    const { page } = handle
    handle.allow(403, '/api/v1/auth/login')
    await page.goto(`${ctx.webUrl}/sign-in`, { waitUntil: 'networkidle0' })
    await fill(page, 'input[name="email"]', email)
    await fill(page, 'input[name="password"]', TEST_PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForFunction(() => document.body.innerText.includes('Confirm your email address to sign in'))
    await ctx.screenshot(page, '1-unverified-alert')

    await clickText(page, 'Resend the link', 'button')
    await page.waitForFunction(() => document.body.innerText.includes('a new link is on its way'))
    await clickText(page, 'Resend the link', 'button')
    await page.waitForFunction(() => /Please wait \d+ seconds? before asking for another link/.test(document.body.innerText))
    ctx.check(/Please wait (5\d|60) seconds/.test(await bodyText(page)), 'the wait time is about a minute')
    await ctx.screenshot(page, '2-wait')
    ctx.assertClean(handle.issues, 'sign-in page')
  },
}
