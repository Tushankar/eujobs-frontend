import { clickText, fill, submitSignIn, waitForPath, waitForText } from '../lib/flows.js'

/** Temporary (2026-11-26): screenshots of the wrong-page notice in light and dark. Delete after the check. */
export default {
  name: 'ZZ tmp notice look',
  viewports: ['D', 'M'],
  async run(ctx) {
    const emma = ctx.seedCredentials.email('emma')
    const handle = await ctx.newPage()
    handle.allow(401, '/api/v1/auth/login')
    const { page } = handle
    await page.goto(`${ctx.webUrl}/recruiter/sign-in`, { waitUntil: 'networkidle0' })
    await fill(page, 'input[name="email"]', emma)
    await fill(page, 'input[name="password"]', ctx.seedCredentials.password)
    await submitSignIn(page, emma)
    await waitForPath(page, '/candidate')
    await waitForText(page, 'You’re in your Candidate workspace')
    await clickText(page, 'Skip for now', '[role="dialog"] button').catch(() => {})
    await new Promise((resolve) => setTimeout(resolve, 800))
    await ctx.screenshot(page, '1-light')
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }])
    await new Promise((resolve) => setTimeout(resolve, 500))
    await ctx.screenshot(page, '2-dark')
    await page.hover('[role="status"] button[aria-label="Close"]')
    await ctx.screenshot(page, '3-dark-hover')
  },
}
