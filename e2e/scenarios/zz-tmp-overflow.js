// TEMPORARY: which element overflows on the phone admin authenticator step; deleted after the run.
import { fill, responseTo } from '../lib/flows.js'
import { login } from '../lib/testApi.js'

export default {
  name: 'TMP overflow',
  viewports: ['M'],
  async run(ctx) {
    const email = ctx.seedCredentials.email(null)
    await login(email, ctx.seedCredentials.password, 'admin')
    const { page } = await ctx.newPage()
    await page.goto(`${ctx.webUrl}/admin/sign-in`, { waitUntil: 'networkidle0' })
    await fill(page, 'input[name="email"]', email)
    await fill(page, 'input[name="password"]', ctx.seedCredentials.password)
    const res = responseTo(page, '/api/v1/auth/login', 'POST')
    await page.click('button[type="submit"]')
    await res
    await page.waitForSelector('[data-login-step]')
    await new Promise((resolve) => setTimeout(resolve, 800))
    const wide = await page.evaluate(() =>
      [...document.querySelectorAll('body *')]
        .map((el) => ({ el, box: el.getBoundingClientRect() }))
        .filter(({ box }) => box.right > window.innerWidth + 0.5 && box.width > 0)
        .map(({ el, box }) => `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 40)} right=${Math.round(box.right)} w=${Math.round(box.width)} "${el.innerText?.slice(0, 30).replace(/\s+/g, ' ')}"`),
    )
    ctx.note(`viewport ${await page.evaluate(() => window.innerWidth)}; overflowing: ${wide.slice(0, 12).join(' | ') || 'none'}`)
    await ctx.screenshot(page, 'totp-step')
  },
}
