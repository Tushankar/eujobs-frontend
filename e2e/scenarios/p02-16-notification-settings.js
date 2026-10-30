import { signInWithForm } from '../lib/flows.js'
import { db } from '../lib/testApi.js'

const switchState = (page) => page.$$eval('main [role="switch"]', (switches) => switches.map((element) => element.getAttribute('aria-checked')))

/** P2-16 (OD6, M-095): only the email toggle is present, and it persists on the account. */
export default {
  name: 'P2-16 Notification settings',
  viewports: ['D'],
  async run(ctx) {
    const emma = ctx.seedCredentials.email('emma')
    try {
      const handle = await ctx.newPage()
      const { page } = handle
      await signInWithForm(page, ctx.webUrl, '/sign-in', emma, ctx.seedCredentials.password)
      await page.goto(`${ctx.webUrl}/candidate/settings/notifications`, { waitUntil: 'networkidle0' })
      const initial = await switchState(page)
      ctx.check(JSON.stringify(initial) === '["true"]', `switches: ${JSON.stringify(initial)}`)
      await page.click('main [role="switch"]')
      await page.waitForFunction(() => document.querySelector('main [role="switch"]').getAttribute('aria-checked') === 'false')
      await page.waitForNetworkIdle()
      await page.reload({ waitUntil: 'networkidle0' })
      ctx.check(JSON.stringify(await switchState(page)) === '["false"]', 'the toggle stays off after a reload')
      await ctx.screenshot(page, 'email-off')
      const [user] = await db('users', 'find', { filter: { email: emma } })
      ctx.check(user.notifyEmail === false, 'saved on the account')
      ctx.assertClean(handle.issues, 'notification settings')
    } finally {
      await db('users', 'updateMany', { filter: { email: emma }, update: { $set: { notifyEmail: true } } })
    }
  },
}
