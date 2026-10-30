import { fill, waitForPath } from '../lib/flows.js'
import { mailTo, TEST_PASSWORD } from '../lib/testApi.js'

/** P2-03: an existing email gets the same check-email screen, and the owner gets "already registered". */
export default {
  name: 'P2-03 Duplicate sign-up',
  viewports: ['D'],
  async run(ctx) {
    const existing = ctx.seedCredentials.email('alex')
    const handle = await ctx.newPage()
    const { page } = handle
    await page.goto(`${ctx.webUrl}/sign-up`, { waitUntil: 'networkidle0' })
    await fill(page, 'input[name="fullName"]', 'Someone Else')
    await fill(page, 'input[name="email"]', existing)
    await fill(page, 'input[name="password"]', TEST_PASSWORD)
    await fill(page, 'input[name="confirmPassword"]', TEST_PASSWORD)
    await page.$eval('input[name="acceptTerms"]', (box) => box.click())
    await page.click('button[type="submit"]')
    await waitForPath(page, '/sign-up/check-email')
    await page.waitForNetworkIdle()
    await ctx.screenshot(page, 'check-email')

    const already = await mailTo(existing, 'already_registered')
    const verify = await mailTo(existing, 'verify_email')
    ctx.check(already.length === 1 && verify.length === 0, `expected one already_registered email, got ${already.length} (and ${verify.length} verify)`)
    ctx.assertClean(handle.issues, 'sign-up page')
  },
}
