import { completeCandidate, tickIn } from '../lib/applicants.js'
import { clickText, signInWithForm, waitForText } from '../lib/flows.js'
import { createAlertApi, fillAlertForm } from '../lib/messages.js'
import { approvedRecruiter, jobBody, postJob } from '../lib/recruiters.js'
import { mailTo } from '../lib/testApi.js'

/**
 * P7-10 (M-098, U35): "react senior" matches only jobs with both words in the listed fields (here the title and the
 * level label). An alert made in Spanish matches through the Spanish level label ("intermedio").
 */
export default {
  name: 'P7-10 Keyword rule',
  viewports: ['D'],
  async run(ctx) {
    const tag = `k${Date.now() % 100000}`
    const name = `React senior ${tag}`
    const handle = await ctx.newPage()
    const { page } = handle
    await signInWithForm(page, ctx.webUrl, '/sign-in', ctx.seedCredentials.email('emma'), ctx.seedCredentials.password)
    await page.goto(`${ctx.webUrl}/candidate/job-alerts`, { waitUntil: 'networkidle0' })
    await clickText(page, 'Create job alert', '[data-create-alert]')
    await page.waitForSelector('[role="dialog"] input[name="alertName"]', { visible: true })
    await fillAlertForm(page, { name, keywords: `react senior ${tag}`, frequency: 'instant' })
    await clickText(page, 'Create alert', '[role="dialog"] button')
    await waitForText(page, name)
    await ctx.screenshot(page, '1-alert')
    ctx.assertClean(handle.issues, 'keyword alert')

    const spanish = await completeCandidate('Ines', { language: 'es' })
    await createAlertApi(spanish.token, { name: `React intermedio ${tag}`, keywords: `react intermedio ${tag}` })

    const recruiter = await approvedRecruiter('Keywords')
    const titles = { both: `React ${tag} Engineer`, reactMid: `React ${tag} Developer`, seniorOnly: `Designer ${tag}` }
    await postJob(recruiter.token, jobBody({ title: titles.both, level: 'senior' }))
    await postJob(recruiter.token, jobBody({ title: titles.reactMid, level: 'mid' }))
    await postJob(recruiter.token, jobBody({ title: titles.seniorOnly, level: 'senior' }))
    await tickIn(0)

    const listed = async (email, alertName) => (await mailTo(email, 'alert_instant')).filter((mail) => mail.params.alertName === alertName).map((mail) => mail.params.job)
    const english = await listed(ctx.seedCredentials.email('emma'), name)
    ctx.check(english.length === 1 && english[0] === titles.both, `"react senior" matches only the senior React job (${english})`)
    const viaSpanish = await listed(spanish.email, `React intermedio ${tag}`)
    ctx.check(viaSpanish.length === 1 && viaSpanish[0] === titles.reactMid, `the Spanish alert matches the mid-level job through "Intermedio" (${viaSpanish})`)
  },
}
