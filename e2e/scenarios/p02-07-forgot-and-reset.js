import { fill, signInWithForm, waitForPath } from '../lib/flows.js'
import { linkToken, TEST_PASSWORD, uniqueEmail, verifiedCandidate } from '../lib/testApi.js'

const NEW_PASSWORD = 'Copper-Meadow-71'

async function requestReset(page, webUrl, email) {
  await page.goto(`${webUrl}/forgot-password`, { waitUntil: 'networkidle0' })
  await fill(page, 'input[name="email"]', email)
  await page.click('button[type="submit"]')
  await page.waitForFunction(() => document.body.innerText.includes('If an account exists for'))
}

/**
 * P2-07 (M-009): a neutral reply for unknown and known addresses; the link opens /reset-password with
 * translated rule errors; success links to the role's sign-in; an old session in another tab gets 401
 * and returns to sign-in with ?next.
 */
export default {
  name: 'P2-07 Forgot and reset',
  viewports: ['D', 'M'],
  async run(ctx) {
    const email = uniqueEmail('p207')
    await verifiedCandidate(email, TEST_PASSWORD)

    const oldTab = await ctx.newPage()
    oldTab.allow(401, '/api/v1/me')
    await signInWithForm(oldTab.page, ctx.webUrl, '/sign-in', email, TEST_PASSWORD)
    await waitForPath(oldTab.page, '/candidate/onboarding/story')

    const handle = await ctx.newPage(oldTab.page.browserContext())
    await handle.page.bringToFront()
    handle.allow(422, '/api/v1/auth/reset-password')
    const { page } = handle
    await requestReset(page, ctx.webUrl, uniqueEmail('nobody'))
    await requestReset(page, ctx.webUrl, email)
    await handle.checkOverflow()
    await ctx.screenshot(page, '1-neutral-confirmation')

    await page.goto((await linkToken(email, 'password_reset')).href, { waitUntil: 'networkidle0' })
    await waitForPath(page, '/reset-password')
    await fill(page, 'input[name="password"]', 'short')
    await fill(page, 'input[name="confirmPassword"]', 'short')
    await page.click('button[type="submit"]')
    await page.waitForFunction(() => document.body.innerText.includes('Use at least 8 characters.'))
    await fill(page, 'input[name="password"]', 'password')
    await fill(page, 'input[name="confirmPassword"]', 'password')
    await page.click('button[type="submit"]')
    await page.waitForFunction(() => document.body.innerText.includes('This password is too common. Choose another one.'))
    await ctx.screenshot(page, '2-rule-errors')

    await fill(page, 'input[name="password"]', NEW_PASSWORD)
    await fill(page, 'input[name="confirmPassword"]', NEW_PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForFunction(() => document.body.innerText.includes('Password changed.'))
    ctx.check(await page.$('a[href="/sign-in"]'), 'success links to the candidate sign-in')
    await ctx.screenshot(page, '3-changed')

    // The other tab still holds the old token: its next request is refused and it returns to sign-in.
    // (A background tab renders no frames, so each tab is brought to the front before it is used.)
    await oldTab.page.bringToFront()
    await oldTab.page.reload({ waitUntil: 'networkidle0' })
    await waitForPath(oldTab.page, '/sign-in')
    const next = new URL(oldTab.page.url()).searchParams.get('next')
    ctx.check(next === '/candidate/onboarding/story', `old tab returns with ?next=${next}`)
    await ctx.screenshot(oldTab.page, '4-old-tab-signed-out')

    await page.bringToFront()
    await signInWithForm(page, ctx.webUrl, '/sign-in', email, NEW_PASSWORD)
    ctx.check(new URL(page.url()).pathname.startsWith('/candidate'), 'the new password signs in')
    ctx.assertClean(handle.issues, 'reset tab')
    ctx.assertClean(oldTab.issues, 'old tab')
  },
}
