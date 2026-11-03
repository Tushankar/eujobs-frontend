import { recruiterWithJob, tickIn } from '../lib/applicants.js'
import { clickText, pageApi, signInWithForm, waitForText } from '../lib/flows.js'
import { fillAlertForm } from '../lib/messages.js'
import { jobBody } from '../lib/recruiters.js'
import { api, mailTo } from '../lib/testApi.js'

/**
 * P7-08 (M-096, M-097, U35): Emma creates an instant "designer" alert with the header country on Germany. A recruiter
 * publishes a matching Berlin job → one email listing it. Pausing, resuming and editing the job send nothing more.
 */
export default {
  name: 'P7-08 Instant alert',
  viewports: ['D', 'M'],
  async run(ctx) {
    const name = `Designer roles ${ctx.viewport} ${Date.now() % 100000}`
    const handle = await ctx.newPage()
    const { page } = handle
    await signInWithForm(page, ctx.webUrl, '/sign-in', ctx.seedCredentials.email('emma'), ctx.seedCredentials.password)
    ctx.check((await pageApi(page, '/me', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pickerCountry: 'DE' }) })).status === 200, 'the header country is Germany')
    try {
      await page.goto(`${ctx.webUrl}/candidate/job-alerts`, { waitUntil: 'networkidle0' })
      await clickText(page, 'Create job alert', '[data-create-alert]')
      await page.waitForSelector('[role="dialog"] input[name="alertName"]', { visible: true })
      ctx.check((await page.$eval('[role="dialog"]', (dialog) => dialog.innerText)).includes('new jobs in Germany'), 'the dialog names the alert country')
      await fillAlertForm(page, { name, keywords: 'designer', frequency: 'instant' })
      await handle.checkOverflow()
      await ctx.screenshot(page, '1-create')
      await clickText(page, 'Create alert', '[role="dialog"] button')
      await waitForText(page, name)
      const card = await page.$eval(`[data-alert-name="${name}"]`, (item) => item.innerText)
      ctx.check(card.includes('Instant') && card.includes('Germany') && card.includes('Active'), `the card reads Instant · Germany · Active: ${card}`)
      await handle.checkOverflow()
      await ctx.screenshot(page, '2-alert-list')
    } finally {
      await pageApi(page, '/me', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pickerCountry: 'GB' }) })
    }

    const { recruiter, job } = await recruiterWithJob(`Berlin${ctx.viewport}`, { city: 'berlin', title: 'Product Designer' })
    await tickIn(0)
    const sent = async () => (await mailTo(ctx.seedCredentials.email('emma'), 'alert_instant')).filter((mail) => mail.params.alertName === name)
    const [mail] = await sent()
    ctx.check(mail?.params.items.length === 1 && mail.params.items[0].startsWith('Product Designer · ') && mail.params.items[0].endsWith(' · Berlin'), `the email lists the job (${mail?.params.items})`)
    ctx.check(mail.params.link.endsWith(`/candidate/jobs/${job.id}`), 'the email links to the job')

    for (const status of ['paused', 'published']) await api(`/recruiter/jobs/${job.id}/status`, { method: 'PATCH', token: recruiter.token, body: { status } })
    await api(`/recruiter/jobs/${job.id}`, { method: 'PUT', token: recruiter.token, body: jobBody({ city: 'berlin', title: 'Senior Product Designer' }) })
    await tickIn(0)
    ctx.check((await sent()).length === 1, 'pause, resume and edit send no second email')
    ctx.assertClean(handle.issues, 'instant alert')
  },
}
