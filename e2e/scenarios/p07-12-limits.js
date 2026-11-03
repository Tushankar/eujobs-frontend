import { setTextarea } from '../lib/applicants.js'
import { clickText, signInWithForm, waitForText } from '../lib/flows.js'
import { alertsOf, createAlertApi, fillAlertForm } from '../lib/messages.js'
import { login } from '../lib/recruiters.js'
import { api } from '../lib/testApi.js'

/** P7-12 (M-031, M-086): an 11th alert, an 81-character alert name and a 2,001-character message are refused. */
export default {
  name: 'P7-12 Limits',
  viewports: ['D'],
  async run(ctx) {
    const token = await login(ctx.seedCredentials.email('emma'), 'candidate', ctx.seedCredentials.password)
    const created = []
    const handle = await ctx.newPage()
    const { page } = handle
    handle.allow(422, '/api/v1/candidate/job-alerts')
    try {
      for (let count = (await alertsOf(token)).items.length; count < 10; count += 1) {
        created.push((await createAlertApi(token, { name: `Limit ${count}`, keywords: `limit${count}` })).id)
      }
      await signInWithForm(page, ctx.webUrl, '/sign-in', ctx.seedCredentials.email('emma'), ctx.seedCredentials.password)
      await page.goto(`${ctx.webUrl}/candidate/job-alerts`, { waitUntil: 'networkidle0' })

      await clickText(page, 'Create job alert', '[data-create-alert]')
      await page.waitForSelector('[role="dialog"] input[name="alertName"]', { visible: true })
      await fillAlertForm(page, { name: 'x'.repeat(81), keywords: 'designer' })
      await clickText(page, 'Create alert', '[role="dialog"] button')
      await waitForText(page, 'Use at most 80 characters.')
      await ctx.screenshot(page, '1-name-too-long')

      await fillAlertForm(page, { name: 'The eleventh alert', keywords: 'designer' })
      await clickText(page, 'Create alert', '[role="dialog"] button')
      await waitForText(page, 'You can have up to 10 job alerts.')
      await ctx.screenshot(page, '2-eleventh')
      ctx.check((await alertsOf(token)).items.length === 10, 'still 10 alerts')
    } finally {
      for (const id of created) await api(`/candidate/job-alerts/${id}`, { method: 'DELETE', token })
    }

    await page.goto(`${ctx.webUrl}/candidate/messages`, { waitUntil: 'networkidle0' })
    await page.click('[data-conversation]')
    await page.waitForSelector('textarea[name="body"]', { visible: true })
    await setTextarea(page, 'textarea[name="body"]', 'x'.repeat(2001))
    await clickText(page, 'Send', 'footer button')
    await waitForText(page, 'Keep your message to 2000 characters or fewer.')
    await ctx.screenshot(page, '3-message-too-long')
    ctx.assertClean(handle.issues, 'limits')
  },
}
