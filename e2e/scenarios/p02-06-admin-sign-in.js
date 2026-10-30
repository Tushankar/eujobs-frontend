import { bodyText, fill, waitForPath } from '../lib/flows.js'

/** P2-06 (M-198): the Owner signs in on the admin page; the restricted notice and Forgot link show, no demo note. */
export default {
  name: 'P2-06 Admin sign-in',
  viewports: ['D', 'M'],
  async run(ctx) {
    const handle = await ctx.newPage()
    const { page } = handle
    await page.goto(`${ctx.webUrl}/admin/sign-in`, { waitUntil: 'networkidle0' })
    const text = await bodyText(page)
    ctx.check(text.includes('Access is restricted to authorised staff. Accounts are created by an administrator.'), 'restricted notice shown')
    ctx.check(await page.$('a[href="/forgot-password"]'), 'Forgot password link shown')
    ctx.check(!/demo/i.test(text), 'no demo note')
    await handle.checkOverflow()
    await ctx.screenshot(page, '1-admin-sign-in')

    await fill(page, 'input[name="email"]', ctx.seedCredentials.email(null))
    await fill(page, 'input[name="password"]', ctx.seedCredentials.password)
    await page.click('button[type="submit"]')
    await waitForPath(page, () => location.pathname === '/admin')
    await page.waitForNetworkIdle()
    await handle.checkOverflow()
    await ctx.screenshot(page, '2-admin-overview')
    ctx.assertClean(handle.issues, 'admin sign-in')
  },
}
