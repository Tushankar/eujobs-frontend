import { mailTo } from '../lib/testApi.js'

/*
 * P1-03: from page context, GET /me without a token is 401 AUTH_REQUIRED; with a token from
 * POST /auth/login (seeded Emma, candidate portal) it is 200 with role candidate and status active.
 * Since 2026-11-18 a new browser first gets { verification } and finishes with the emailed code
 * (POST /auth/login/verify). The credentials go straight into the page and are never printed.
 */
export default {
  name: 'P1-03 API contract from the browser',
  viewports: ['D'],
  async run(ctx) {
    const handle = await ctx.newPage()
    const { page } = handle
    handle.allow(401, '/api/v1/me')
    await page.goto(`${ctx.webUrl}/sign-in`, { waitUntil: 'networkidle0' })

    const anonymous = await page.evaluate(async () => {
      const res = await fetch('/api/v1/me')
      return { status: res.status, body: await res.json() }
    })
    ctx.check(
      anonymous.status === 401 && anonymous.body.error?.code === 'AUTH_REQUIRED',
      `GET /me without a token: ${anonymous.status} ${JSON.stringify(anonymous.body)}`,
    )

    const post = (path, body) =>
      page.evaluate(
        async (url, payload) => {
          const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
          return { status: res.status, body: await res.json() }
        },
        path,
        body,
      )
    const login = await post('/api/v1/auth/login', { email: ctx.seedCredentials.email('emma'), password: ctx.seedCredentials.password, portal: 'candidate' })
    ctx.check(login.status === 200 && login.body.verification?.method === 'email' && !login.body.token, `a new browser is asked for the emailed code (${login.status})`)
    const code = (await mailTo(ctx.seedCredentials.email('emma'), 'login_code')).at(-1).params.code
    const verified = await post('/api/v1/auth/login/verify', { challenge: login.body.verification.challenge, code })
    const signedIn = await page.evaluate(async (token) => {
      const res = await fetch('/api/v1/me', { headers: { Authorization: `Bearer ${token}` } })
      const me = await res.json()
      return { status: res.status, role: me.role, accountStatus: me.status }
    }, verified.body.token)
    signedIn.loginStatus = verified.status
    ctx.check(
      signedIn.loginStatus === 200 && signedIn.status === 200 && signedIn.role === 'candidate' && signedIn.accountStatus === 'active',
      `login + GET /me: ${JSON.stringify(signedIn)}`,
    )
    await ctx.screenshot(page, 'api-contract')
    ctx.assertClean(handle.issues, 'API contract page')
  },
}
