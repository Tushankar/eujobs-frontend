import { signInWithForm } from '../lib/flows.js'
import { login } from '../lib/recruiters.js'
import { subscribeThroughApi, waitForPlan } from '../lib/payments.js'
import { api, db } from '../lib/testApi.js'

const ACTIVE = ['applied', 'under_review', 'interview', 'offer', 'hired']

/** The local calendar date of `instant` in `timeZone`, and the weekday (1 = Monday). */
function localDay(instant, timeZone) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(instant).map((part) => [part.type, part.value]))
  return `${parts.year}-${parts.month}-${parts.day}`
}

/**
 * P6-08 (M-082, M-178, M-083, M-170): on Sarah's Overview the Applications KPI equals the database count of active
 * applications, the funnel lists Acme's stages with ever-reached counts, and the momentum buckets follow the
 * browser's time zone (CDP override) with Monday weeks.
 */
export default {
  name: 'P6-08 KPIs and charts',
  viewports: ['D'],
  async run(ctx) {
    // A fresh application today: Daniel (a seeded applicant) subscribes again and applies to another Acme job.
    const danielEmail = 'daniel.kim@example.com'
    const daniel = { token: await login(danielEmail, 'candidate', ctx.seedCredentials.password) }
    const me = (await api('/me', { token: daniel.token })).body
    await subscribeThroughApi({ ...me, email: danielEmail })
    await waitForPlan(daniel.token, 'plus')
    const sarahToken = await login(ctx.seedCredentials.email('sarah'), 'recruiter', ctx.seedCredentials.password)
    const acmeJobs = (await api('/recruiter/jobs', { token: sarahToken })).body.items
    const target = acmeJobs.find((job) => job.title === 'Senior Product Designer')
    const applied = await api('/candidate/applications', { method: 'POST', token: daniel.token, body: { jobId: target.id, consent: true } })
    ctx.check(applied.status === 201, `Daniel applies today (${applied.status})`)

    const [company] = await db('companies', 'find', { filter: { displayName: 'Acme Studio' } })
    const applications = await db('applications', 'find', { filter: { companyId: company._id } })
    const active = applications.filter((application) => ACTIVE.includes(application.status)).length
    const stages = (await db('pipelinestages', 'find', { filter: { companyId: company._id } })).sort((a, b) => a.order - b.order)
    const reached = (stage) => applications.filter((application) => application.status !== 'withdrawn' && application.history.some((step) => step.stageId.$oid === stage._id.$oid)).length

    for (const timeZone of ['Pacific/Auckland', 'America/Los_Angeles']) {
      const handle = await ctx.newPage()
      const { page } = handle
      await page.emulateTimezone(timeZone)
      await signInWithForm(page, ctx.webUrl, '/recruiter/sign-in', ctx.seedCredentials.email('sarah'), ctx.seedCredentials.password)
      await page.goto(`${ctx.webUrl}/recruiter`, { waitUntil: 'networkidle0' })
      await page.waitForFunction(() => document.querySelector('[data-momentum]')?.dataset.momentum !== '[]')

      const kpi = await page.$eval('[data-stat="applications"]', (element) => element.innerText)
      ctx.check(kpi.includes(String(active)), `KPI ${active} (${kpi.replace(/\s+/g, ' ')})`)
      const funnel = await page.$$eval('[data-funnel-stage]', (rows) => rows.map((row) => [row.dataset.funnelStage, Number(row.dataset.count)]))
      ctx.check(JSON.stringify(funnel) === JSON.stringify(stages.map((stage) => [stage.name, reached(stage)])), `funnel = stages ever reached: ${JSON.stringify(funnel)}`)

      const days = JSON.parse(await page.$eval('[data-momentum]', (element) => element.dataset.momentum))
      const monday = new Date(`${days[0].date}T12:00:00Z`).getUTCDay() === 1
      const today = localDay(new Date(), timeZone)
      const todays = days.find((day) => day.date === today)
      ctx.check(days.length === 7 && monday, `a Monday-to-Sunday week (${days[0].date})`)
      ctx.check(todays && todays.applications >= 1, `today's application is on ${today} in ${timeZone} (${JSON.stringify(days)})`)
      ctx.note(`${timeZone}: ${days.map((day) => `${day.date}:${day.applications}/${day.shortlisted}`).join(' ')}`)
      await ctx.screenshot(page, `overview-${timeZone.split('/')[1]}`)
      ctx.assertClean(handle.issues, timeZone)
    }
  },
}
