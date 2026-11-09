import { completeCandidate } from '../lib/applicants.js'
import { signInWithForm } from '../lib/flows.js'
import { approvedRecruiter } from '../lib/recruiters.js'
import { TEST_PASSWORD } from '../lib/testApi.js'

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** Temporary: Data & account as LinkedIn rows (candidate, recruiter) and Admin Settings on the shared rows. */
async function shoot(ctx, email, password, signIn, path, name, openPassword) {
  const handle = await ctx.newPage()
  const { page } = handle
  if (ctx.viewport === 'D') await page.setViewport({ width: 1366, height: 768 })
  await signInWithForm(page, ctx.webUrl, signIn, email, password)
  await page.goto(`${ctx.webUrl}${path}`, { waitUntil: 'networkidle0' })
  await page.waitForSelector('[data-setting="password"]', { visible: true, timeout: 20_000 })
  await pause(700)
  await handle.checkOverflow()
  await page.$eval('[data-setting]', (element) => element.closest('section').scrollIntoView({ block: 'start' }))
  await page.evaluate(() => window.scrollBy(0, -100))
  await pause(300)
  await ctx.screenshot(page, `${name}-rows`)
  if (openPassword) {
    await page.click('[data-setting="password"] button')
    await page.waitForSelector('input[name="currentPassword"]', { visible: true })
    await pause(300)
    await handle.checkOverflow()
    await ctx.screenshot(page, `${name}-password-open`)
    // Typing ticks the live rules: length and email now, the match once the confirmation agrees.
    await page.type('input[name="newPassword"]', 'Quiet-Harbour-2026')
    await page.type('input[name="confirmPassword"]', 'Quiet-Harbour-2026')
    await pause(200)
    const done = await page.$$eval('[data-password-rules] [data-done]', (items) => items.map((item) => item.dataset.rule))
    ctx.check(['length', 'email', 'match'].every((rule) => done.includes(rule)), `rules ticked: ${done.join(', ')}`)
    await ctx.screenshot(page, `${name}-password-typed`)
  }
  ctx.assertClean(handle.issues, name)
}

export default {
  name: 'ZZ data account look',
  viewports: ['D', 'M'],
  async run(ctx) {
    const candidate = await completeCandidate(`DataAcc${ctx.viewport}`, { plus: false })
    await shoot(ctx, candidate.email, TEST_PASSWORD, '/sign-in', '/candidate/settings/data-account', '1-candidate', true)
    if (ctx.viewport !== 'D') return
    const recruiter = await approvedRecruiter(`DataAccRec${ctx.viewport}`, { plus: false })
    await shoot(ctx, recruiter.email, TEST_PASSWORD, '/recruiter/sign-in', '/recruiter/settings/data-account', '2-recruiter', false)
    await shoot(ctx, ctx.seedCredentials.email(null), ctx.seedCredentials.password, '/admin/sign-in', '/admin/settings', '3-admin', true)
  },
}
