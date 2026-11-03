import { completeCandidate, recruiterWithJob } from '../lib/applicants.js'
import { clickText, signInWithForm, waitForText } from '../lib/flows.js'
import { fillAlertForm, localHour } from '../lib/messages.js'
import { api, mailTo, TEST_PASSWORD } from '../lib/testApi.js'

const MINUTE = 60 * 1000
const tickAt = (date) => api('/_test/scheduler/tick', { method: 'POST', body: { now: date.toISOString() } })

/**
 * P7-09 (U12): a daily alert of a user in Europe/Madrid. At 07:59 local nothing is sent; at 08:00 a digest lists the
 * jobs first published since the alert was created; the next day, with no new jobs, nothing is sent.
 */
export default {
  name: 'P7-09 Digest',
  viewports: ['D'],
  async run(ctx) {
    const user = await completeCandidate('Madrid')
    const handle = await ctx.newPage()
    const { page } = handle
    // U12: sign-in saves the browser's time zone, so the browser is put in Madrid (CDP time-zone override).
    await page.emulateTimezone('Europe/Madrid')
    await signInWithForm(page, ctx.webUrl, '/sign-in', user.email, TEST_PASSWORD)
    ctx.check((await api('/me', { token: user.token })).body.timezone === 'Europe/Madrid', 'sign-in saved the time zone Europe/Madrid')
    await page.goto(`${ctx.webUrl}/candidate/job-alerts`, { waitUntil: 'networkidle0' })
    await clickText(page, 'Create job alert', '[data-create-alert]')
    await page.waitForSelector('[role="dialog"] input[name="alertName"]', { visible: true })
    const keyword = `digest${Date.now() % 100000}`
    await fillAlertForm(page, { name: 'Morning digest', keywords: keyword, frequency: 'daily' })
    await clickText(page, 'Create alert', '[role="dialog"] button')
    await waitForText(page, 'Daily digest')
    await ctx.screenshot(page, '1-daily-alert')
    ctx.assertClean(handle.issues, 'daily alert')

    await recruiterWithJob('DigestOne', { title: `Designer ${keyword}` })
    await recruiterWithJob('DigestTwo', { title: `Researcher ${keyword}` })
    await recruiterWithJob('DigestOff', { title: 'Accountant' })
    // The next 08:00 in Madrid after the alert was created, and the one a day later.
    const days = localHour('Europe/Madrid', 0, 8) > new Date() ? 0 : 1
    const next8 = localHour('Europe/Madrid', days, 8)
    const digests = () => mailTo(user.email, 'alert_daily')

    await tickAt(new Date(next8.getTime() - MINUTE))
    ctx.check((await digests()).length === 0, 'nothing at 07:59 Madrid time')
    await tickAt(next8)
    const [mail] = await digests()
    ctx.check(mail?.params.items.length === 2 && mail.params.items.every((item) => item.includes(keyword)), `the 08:00 digest lists the two matching jobs (${mail?.params.items})`)
    ctx.check(mail.subject === `2 new jobs for “Morning digest”`, `subject: ${mail.subject}`)
    await tickAt(localHour('Europe/Madrid', days + 1, 8))
    ctx.check((await digests()).length === 1, 'no digest the next day without new jobs')
  },
}
