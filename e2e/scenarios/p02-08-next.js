import { fill, waitForPath } from '../lib/flows.js'

async function signInHere(ctx, page) {
  await fill(page, 'input[name="email"]', ctx.seedCredentials.email('emma'))
  await fill(page, 'input[name="password"]', ctx.seedCredentials.password)
  await page.click('button[type="submit"]')
  await page.waitForFunction(() => !location.pathname.startsWith('/sign-in'))
  await page.waitForNetworkIdle()
}

/** P2-08 (M-011): a protected page sends a signed-out visitor to sign-in with ?next and back; foreign ?next is ignored. */
export default {
  name: 'P2-08 ?next',
  viewports: ['D'],
  async run(ctx) {
    const handle = await ctx.newPage()
    const { page } = handle
    await page.goto(`${ctx.webUrl}/candidate/settings/billing`, { waitUntil: 'networkidle0' })
    await waitForPath(page, '/sign-in')
    const next = new URL(page.url()).searchParams.get('next')
    ctx.check(next === '/candidate/settings/billing', `?next is ${next}`)
    await signInHere(ctx, page)
    ctx.check(new URL(page.url()).pathname === '/candidate/settings/billing', `landed on ${new URL(page.url()).pathname}`)
    await ctx.screenshot(page, '1-back-on-billing')

    const foreign = await ctx.newPage()
    await foreign.page.goto(`${ctx.webUrl}/sign-in?next=${encodeURIComponent('https://evil.example')}`, { waitUntil: 'networkidle0' })
    await signInHere(ctx, foreign.page)
    ctx.check(new URL(foreign.page.url()).pathname === '/candidate', `foreign ?next landed on ${foreign.page.url()}`)
    await ctx.screenshot(foreign.page, '2-foreign-next-ignored')
    ctx.assertClean(handle.issues, 'billing return')
    ctx.assertClean(foreign.issues, 'foreign next')
  },
}
