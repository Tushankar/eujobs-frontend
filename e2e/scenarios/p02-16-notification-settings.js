import { responseTo, signInWithForm } from '../lib/flows.js'
import { db } from '../lib/testApi.js'

const switchState = (page) => page.$$eval('main [data-email-switches] [role="switch"]', (switches) => switches.map((element) => element.getAttribute('aria-checked')))

/**
 * P2-16 (P11b-Q3, Q12; supersedes OD6): the candidate's four email switches (Applications, Messages, CV requests, Job
 * alerts) are on by default; turning Job alerts off persists on the account.
 */
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
      ctx.check(JSON.stringify(initial) === '["true","true","true","true"]', `switches: ${JSON.stringify(initial)}`)
      const saved = responseTo(page, '/api/v1/me/notifications', 'PATCH')
      await page.click('main [data-email-switches] li:nth-child(4) [role="switch"]')
      await saved
      await page.reload({ waitUntil: 'networkidle0' })
      ctx.check(JSON.stringify(await switchState(page)) === '["true","true","true","false"]', 'Job alerts stays off after a reload')
      await ctx.screenshot(page, 'job-alerts-off')
      const [user] = await db('users', 'find', { filter: { email: emma } })
      ctx.check(JSON.stringify(user.emailOff) === '["job_alerts"]', `saved on the account (${JSON.stringify(user.emailOff)})`)
      ctx.assertClean(handle.issues, 'notification settings')
    } finally {
      await db('users', 'updateMany', { filter: { email: emma }, update: { $unset: { emailOff: '' } } })
    }
  },
}
