/*
 * P1-03: from page context, GET /me without a token is 401 AUTH_REQUIRED; with a token from
 * POST /auth/login (seeded Emma, candidate portal) it is 200 with role candidate and status active.
 * The credentials go straight into the page and are never printed.
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

    const signedIn = await page.evaluate(
      async (email, password) => {
        const login = await fetch('/api/v1/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, portal: 'candidate' }),
        })
        if (!login.ok) return { loginStatus: login.status }
        const { token } = await login.json()
        const res = await fetch('/api/v1/me', { headers: { Authorization: `Bearer ${token}` } })
        const me = await res.json()
        return { loginStatus: login.status, status: res.status, role: me.role, accountStatus: me.status }
      },
      ctx.seedCredentials.email('emma'),
      ctx.seedCredentials.password,
    )
    ctx.check(
      signedIn.loginStatus === 200 && signedIn.status === 200 && signedIn.role === 'candidate' && signedIn.accountStatus === 'active',
      `login + GET /me: ${JSON.stringify(signedIn)}`,
    )
    await ctx.screenshot(page, 'api-contract')
    ctx.assertClean(handle.issues, 'API contract page')
  },
}
