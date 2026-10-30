import { ROUTES } from '../routes.js'
import { signInWithForm } from '../lib/flows.js'
import { db } from '../lib/testApi.js'

/*
 * Visits every route of e2e/routes.js per group, signed in through the sign-in form with the seeded
 * accounts (no session for `public`). A route fails on any page check, a redirect away from it, the
 * 404 panel, the router error screen or a near-empty page.
 */
const GROUPS = {
  public: null,
  candidate: { signIn: '/sign-in', account: 'alex' },
  // James is still onboarding, so these are the pages he can reach.
  recruiterOnboarding: { signIn: '/recruiter/sign-in', account: 'james' },
  recruiter: { signIn: '/recruiter/sign-in', account: 'sarah' },
  admin: { signIn: '/admin/sign-in', account: null },
}
// The onboarding layout opens the first step that is still open, so those pages may redirect by design.
const REDIRECTS_ALLOWED = new Set(['recruiterOnboarding'])

async function visit(ctx, handle, group, path) {
  const { page } = handle
  handle.issues.length = 0
  await page.goto(`${ctx.webUrl}${path}`, { waitUntil: 'networkidle0' })
  await handle.checkOverflow()
  const state = await page.evaluate(() => ({
    path: location.pathname,
    notFound: [...document.querySelectorAll('h1')].some((h1) => h1.textContent.trim() === 'Page not found'),
    routerError: document.body.innerText.includes('Unexpected Application Error'),
    textLength: document.body.innerText.trim().length,
  }))
  await ctx.screenshot(page, `${group}${path}`)

  const problems = [...handle.issues]
  if (!REDIRECTS_ALLOWED.has(group) && state.path !== path) problems.push(`landed on ${state.path}`)
  if (state.notFound) problems.push('404 page')
  if (state.routerError) problems.push('router error screen')
  if (state.textLength < 50) problems.push('near-empty page')
  return problems
}

export default {
  name: 'Route sweep',
  viewports: ['D', 'M'],
  async run(ctx) {
    // P2-Q1: until Phase 4 approves Sarah, the test database makes her active for the recruiter workspace.
    await db('users', 'updateMany', { filter: { email: ctx.seedCredentials.email('sarah') }, update: { $set: { status: 'active' } } })

    const failures = []
    const counts = []
    for (const [group, paths] of Object.entries(ROUTES)) {
      const handle = await ctx.newPage()
      const login = GROUPS[group]
      if (login) {
        await signInWithForm(handle.page, ctx.webUrl, login.signIn, ctx.seedCredentials.email(login.account), ctx.seedCredentials.password)
      }
      for (const path of paths) {
        const problems = await visit(ctx, handle, group, path)
        if (problems.length) failures.push(`${group} ${path}: ${problems.join('; ')}`)
      }
      counts.push(`${group} ${paths.length}`)
    }
    ctx.note(`routes: ${counts.join(', ')}`)
    ctx.check(!failures.length, `${failures.length} route(s) failed:\n  ${failures.join('\n  ')}`)
  },
}
