import { signInWithForm } from '../lib/flows.js'

/** P2-09 (M-011): /, /sign-in and /sign-up send a signed-in user to their own workspace. */
export default {
  name: 'P2-09 Signed-in redirect',
  viewports: ['D'],
  async run(ctx) {
    const handle = await ctx.newPage()
    const { page } = handle
    await signInWithForm(page, ctx.webUrl, '/sign-in', ctx.seedCredentials.email('emma'), ctx.seedCredentials.password)
    for (const path of ['/', '/sign-in', '/sign-up']) {
      await page.goto(`${ctx.webUrl}${path}`, { waitUntil: 'networkidle0' })
      const landed = new URL(page.url()).pathname
      ctx.check(landed === '/candidate', `${path} landed on ${landed}`)
    }
    await ctx.screenshot(page, 'workspace')
    ctx.assertClean(handle.issues, 'signed-in redirects')
  },
}
