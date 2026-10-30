import { fill, waitForPath } from '../lib/flows.js'

async function attempt(ctx, path, email) {
  const handle = await ctx.newPage()
  handle.allow(401, '/api/v1/auth/login')
  const { page } = handle
  await page.goto(`${ctx.webUrl}${path}`, { waitUntil: 'networkidle0' })
  await fill(page, 'input[name="email"]', email)
  await fill(page, 'input[name="password"]', ctx.seedCredentials.password)
  await page.click('button[type="submit"]')
  return handle
}

/** P2-05 (M-005): the other member portal signs in with a notice; the admin portal is admins-only, and admins only there. */
export default {
  name: 'P2-05 Wrong portal',
  viewports: ['D'],
  async run(ctx) {
    const emma = ctx.seedCredentials.email('emma')

    const recruiterPortal = await attempt(ctx, '/recruiter/sign-in', emma)
    await waitForPath(recruiterPortal.page, '/candidate')
    await recruiterPortal.page.waitForFunction(() => document.body.innerText.includes('This account uses this workspace'))
    await ctx.screenshot(recruiterPortal.page, '1-candidate-on-recruiter-portal')
    ctx.assertClean(recruiterPortal.issues, 'recruiter portal')

    for (const [name, path, email] of [
      ['2-candidate-on-admin-portal', '/admin/sign-in', emma],
      ['3-owner-on-candidate-portal', '/sign-in', ctx.seedCredentials.email(null)],
    ]) {
      const handle = await attempt(ctx, path, email)
      await handle.page.waitForFunction(() => document.body.innerText.includes('The email address or password is not right.'))
      ctx.check(new URL(handle.page.url()).pathname === path, `${name}: stays on ${path}`)
      await ctx.screenshot(handle.page, name)
      ctx.assertClean(handle.issues, name)
    }
  },
}
