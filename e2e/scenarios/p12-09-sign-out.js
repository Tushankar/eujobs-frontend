import { signInWithForm, waitForPath } from '../lib/flows.js'

const ROLES = [
  { role: 'recruiter', account: 'sarah', signIn: '/recruiter/sign-in', overview: '/recruiter' },
  { role: 'candidate', account: 'emma', signIn: '/sign-in', overview: '/candidate' },
  { role: 'admin', account: undefined, signIn: '/admin/sign-in', overview: '/admin' },
]

/**
 * P12-09 (P12-C13 follow-up): Sign out from each role's Overview, a page with its own queries (the recruiter's
 * momentum, funnel and jobs), leaves no failed request (no 401) and no console error: the workspace stops its queries
 * and polling and drops the cached responses before the token is cleared.
 */
export default {
  name: 'P12-09 Sign out from the Overview',
  viewports: ['D', 'M'],
  async run(ctx) {
    for (const { role, account, signIn, overview } of ROLES) {
      const handle = await ctx.newPage()
      const { page } = handle
      await signInWithForm(page, ctx.webUrl, signIn, ctx.seedCredentials.email(account), ctx.seedCredentials.password)
      await page.goto(`${ctx.webUrl}${overview}`, { waitUntil: 'networkidle0' })
      await ctx.screenshot(page, `${role}-1-overview`)
      // At 375 px the Sign out button is in the sidebar drawer.
      if (ctx.viewport === 'M') await page.click('[aria-controls="workspace-sidebar"]')
      await page.waitForSelector('[aria-label="Sign out"]', { visible: true })
      await page.click('[aria-label="Sign out"]')
      await waitForPath(page, signIn)
      // Longer than one counters poll would take to fire after a reset.
      await new Promise((resolve) => setTimeout(resolve, 3000))
      ctx.check(!(await page.evaluate(() => localStorage.getItem('lwm-auth-token'))), `${role}: the token is gone`)
      await ctx.screenshot(page, `${role}-2-signed-out`)
      ctx.assertClean(handle.issues, `${role} sign-out from the Overview`)
      ctx.note(`${role}: signed out from ${overview} with no failed request`)
    }
  },
}
