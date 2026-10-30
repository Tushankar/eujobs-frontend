import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { API_PORT } from '../lib/env.js'

/* P1-01: the API (test DB) and Vite start; Chrome reaches health through the Vite proxy. */
export default {
  name: 'P1-01 Harness boot',
  viewports: ['D'],
  async run(ctx) {
    const handle = await ctx.newPage()
    const { page, issues } = handle
    // A bare JSON document declares no icon, so Chrome falls back to /favicon.ico (the app uses /favicon.png).
    handle.allow(404, '/favicon.ico')
    await page.goto(`${ctx.webUrl}/api/v1/health`)
    const body = JSON.parse(await page.evaluate(() => document.body.innerText))
    ctx.check(body.status === 'ok' && body.db === 'up', `health through the proxy returned ${JSON.stringify(body)}`)
    const serverLog = readFileSync(join(ctx.runDir, 'server.log'), 'utf8')
    ctx.check(serverLog.includes(`port ${API_PORT} (database eujobs_test)`), `the API is not on port ${API_PORT} with eujobs_test`)
    await ctx.screenshot(page, 'health-through-proxy')
    ctx.assertClean(issues, 'health')
  },
}
