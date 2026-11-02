import { applyApi, chooseStage, completeCandidate, MINUTE, recruiterWithJob, tickIn } from '../lib/applicants.js'
import { pageApi, signInWithForm } from '../lib/flows.js'
import { TEST_PASSWORD, mailTo } from '../lib/testApi.js'

/** Waits until the server has the application at `stage` (each select change is one request). */
const waitForStage = (page, id, stage) =>
  page.waitForFunction(
    async (applicationId, wanted) => {
      const response = await fetch('/api/v1/recruiter/applications', { headers: { Authorization: `Bearer ${localStorage.getItem('lwm-auth-token')}` } })
      const { items } = await response.json()
      return items.find((item) => item.id === applicationId)?.stage.name === wanted
    },
    { polling: 300, timeout: 10_000 },
    id,
    stage,
  )

/**
 * P6-04 (M-091, U13): the recruiter moves Applied → Screening → Shortlisted in the table within 10 minutes → exactly
 * one "Under review" email after the wait. Interview on the board → an "Interview" email. Interview → Screening →
 * Interview within 10 minutes → no email.
 */
export default {
  name: 'P6-04 Stage emails',
  viewports: ['D'],
  async run(ctx) {
    const { recruiter, job } = await recruiterWithJob('Stages')
    const candidate = await completeCandidate('StageMail')
    const { body: application } = await applyApi(candidate.token, job.id)
    const statusMails = async () => (await mailTo(candidate.email, 'application_status')).map((mail) => mail.params.status)

    const handle = await ctx.newPage()
    const { page } = handle
    await signInWithForm(page, ctx.webUrl, '/recruiter/sign-in', recruiter.email, TEST_PASSWORD)
    await page.goto(`${ctx.webUrl}/recruiter/applications`, { waitUntil: 'networkidle0' })
    const select = `[data-stage-select="${application.id}"] select`
    await chooseStage(page, select, 'Screening')
    await waitForStage(page, application.id, 'Screening')
    await chooseStage(page, select, 'Shortlisted')
    await waitForStage(page, application.id, 'Shortlisted')
    await ctx.screenshot(page, '1-table')
    await tickIn(9 * MINUTE)
    ctx.check((await statusMails()).length === 0, 'nothing before the 10 minutes')
    await tickIn(11 * MINUTE)
    ctx.check(JSON.stringify(await statusMails()) === '["Under review"]', `exactly one "Under review" email (${await statusMails()})`)

    await page.goto(`${ctx.webUrl}/recruiter/hiring-pipeline`, { waitUntil: 'networkidle0' })
    const card = `[data-application="${application.id}"] select`
    await chooseStage(page, card, 'Interview')
    await waitForStage(page, application.id, 'Interview')
    await page.waitForSelector(`[data-column="Interview"] [data-application="${application.id}"]`)
    await ctx.screenshot(page, '2-board')
    await tickIn(11 * MINUTE)
    ctx.check(JSON.stringify(await statusMails()) === '["Under review","Interview"]', `then an "Interview" email (${await statusMails()})`)

    await chooseStage(page, card, 'Screening')
    await waitForStage(page, application.id, 'Screening')
    await page.waitForSelector(`[data-column="Screening"] [data-application="${application.id}"]`)
    await chooseStage(page, card, 'Interview')
    await waitForStage(page, application.id, 'Interview')
    await tickIn(11 * MINUTE)
    ctx.check((await statusMails()).length === 2, 'back to Interview within 10 minutes: no email')
    const history = (await pageApi(page, '/recruiter/applications')).body.items.find((item) => item.id === application.id)
    ctx.check(history.status === 'interview', 'the candidate status is Interview')
    ctx.assertClean(handle.issues, 'stage emails')
  },
}
