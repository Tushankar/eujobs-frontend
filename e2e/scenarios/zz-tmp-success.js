// TEMPORARY (2026-11-17): the success modals, with them switched ON (older scenarios keep them off). Deleted after the run.
import { applyApi, completeCandidate, recruiterWithJob } from '../lib/applicants.js'
import { signInWithForm } from '../lib/flows.js'
import { offerApi } from '../lib/interviews.js'
import { api, TEST_PASSWORD } from '../lib/testApi.js'

const modal = (page, kind, timeout = 20_000) => page.waitForSelector(`[data-success-kind="${kind}"]`, { visible: true, timeout })
/** Waits for the burst to settle, then a screenshot. */
const shot = async (ctx, page, name) => {
  await new Promise((resolve) => setTimeout(resolve, 1600))
  await ctx.screenshot(page, name)
}
const closeModal = async (page) => {
  await page.click('[data-success-close]')
  await new Promise((resolve) => setTimeout(resolve, 500))
}

export default {
  name: 'TMP Success modals',
  viewports: ['D', 'M'],
  async run(ctx) {
    const { recruiter, job } = await recruiterWithJob('Success')
    const candidate = await completeCandidate('Success')

    const handle = await ctx.newPage(undefined, { celebrations: true })
    const { page } = handle
    await signInWithForm(page, ctx.webUrl, '/sign-in', candidate.email, TEST_PASSWORD)

    // 1. Moments decided elsewhere: profile 100% and the Plus plan, each shown once.
    const kinds = []
    for (let index = 0; index < 4; index += 1) {
      const kind = await page
        .waitForSelector('[data-success-kind]', { visible: true, timeout: 8_000 })
        .then((element) => element.evaluate((node) => node.dataset.successKind))
        .catch(() => null)
      if (!kind) break
      kinds.push(kind)
      if (index === 0) await shot(ctx, page, '1-server-moment')
      await closeModal(page)
    }
    ctx.check(kinds.includes('profile_complete') && kinds.includes('plan_started'), `server moments shown once each (${kinds.join(', ')})`)
    await page.reload({ waitUntil: 'networkidle0' })
    ctx.check(!(await page.$('[data-success-kind]')), 'seen moments do not come back after a reload')

    // 2. Applying.
    await page.goto(`${ctx.webUrl}/candidate/jobs/${job.id}`, { waitUntil: 'networkidle0' })
    await page.click('[data-apply]')
    await page.waitForSelector('[data-apply-dialog]', { visible: true })
    await page.$eval('input[name="consent"]', (input) => input.click())
    await page.click('button[form="apply-form"]')
    await modal(page, 'applied')
    const applied = await page.$eval('[data-success-kind="applied"]', (element) => element.innerText)
    ctx.check(applied.includes('Application sent!') && applied.includes(job.title), 'the "Application sent!" modal names the job')
    await shot(ctx, page, '2-applied')
    await closeModal(page)
    // The "Applied" status pill is brand blue now (owner: grey did not look cheerful).
    await page.goto(`${ctx.webUrl}/candidate/applications`, { waitUntil: 'networkidle0' })
    await shot(ctx, page, '2b-applications-list')

    // 3. The first job alert.
    await page.goto(`${ctx.webUrl}/candidate/job-alerts`, { waitUntil: 'networkidle0' })
    await page.click('[data-create-alert]')
    await page.waitForSelector('input[name="alertName"]', { visible: true })
    await page.type('input[name="alertName"]', 'Design roles')
    await page.type('input[name="keywords"]', 'product designer')
    await page.click(`button[form="${await page.$eval('[role="dialog"] form', (form) => form.id)}"]`)
    await modal(page, 'first_alert')
    await shot(ctx, page, '3-first-alert')
    await closeModal(page)

    // 4. Interview confirmed by the candidate.
    const [application] = (await api(`/recruiter/applications?jobId=${job.id}`, { token: recruiter.token })).body.items
    const offered = await offerApi(recruiter.token, { applicationId: application.id })
    await page.goto(`${ctx.webUrl}/candidate/interviews/${offered.id}`, { waitUntil: 'networkidle0' })
    await page.waitForSelector(`[data-slot="${offered.slots[0].startAt}"]`, { visible: true, timeout: 20_000 })
    await page.click(`[data-slot="${offered.slots[0].startAt}"]`)
    await page.click('[data-pick-slot]')
    await modal(page, 'interview_confirmed')
    await shot(ctx, page, '4-interview-confirmed')
    await closeModal(page)
    ctx.assertClean(handle.issues, 'candidate success modals')

    // 5. Recruiter: marking a second applicant (no interview under way) Hired.
    const hiree = await completeCandidate('Hiree')
    await applyApi(hiree.token, job.id)
    const hireeApplication = (await api(`/recruiter/applications?jobId=${job.id}`, { token: recruiter.token })).body.items.find((item) => item.candidate.id === hiree.id)
    const recruiterHandle = await ctx.newPage(undefined, { celebrations: true })
    const rp = recruiterHandle.page
    await signInWithForm(rp, ctx.webUrl, '/recruiter/sign-in', recruiter.email, TEST_PASSWORD)
    for (let index = 0; index < 3; index += 1) {
      if (!(await rp.$('[data-success-kind]'))) break
      await closeModal(rp)
    }
    const stages = (await api('/recruiter/pipeline', { token: recruiter.token })).body.items
    const hired = stages.find((stage) => stage.category === 'hired')
    await rp.goto(`${ctx.webUrl}/recruiter/applications?jobId=${job.id}`, { waitUntil: 'networkidle0' })
    await rp.select(`[data-stage-select="${hireeApplication.id}"] select`, hired.id)
    await modal(rp, 'candidate_hired')
    const hiredText = await rp.$eval('[data-success-kind="candidate_hired"]', (element) => element.innerText)
    ctx.check(hiredText.includes('Great hire!') && hiredText.includes(hiree.fullName), `the recruiter's "Great hire!" names the candidate`)
    await shot(ctx, rp, '5-candidate-hired')
    await recruiterHandle.checkOverflow()
    ctx.assertClean(recruiterHandle.issues, 'recruiter success modals')

    // 6. The hired candidate's "you got the role" arrives with the delayed status (10-minute undo window).
    await api('/_test/scheduler/tick', { method: 'POST', body: { now: new Date(Date.now() + 11 * 60_000).toISOString() } })
    const hireeHandle = await ctx.newPage(undefined, { celebrations: true })
    const hp = hireeHandle.page
    await signInWithForm(hp, ctx.webUrl, '/sign-in', hiree.email, TEST_PASSWORD)
    let found = false
    for (let index = 0; index < 4 && !found; index += 1) {
      const kind = await hp
        .waitForSelector('[data-success-kind]', { visible: true, timeout: 10_000 })
        .then((element) => element.evaluate((node) => node.dataset.successKind))
        .catch(() => null)
      if (!kind) break
      if (kind === 'hired') found = true
      else await closeModal(hp)
    }
    ctx.check(found, 'the hired candidate sees "you got the role"')
    await shot(ctx, hp, '6-hired')
    await hireeHandle.checkOverflow()
    ctx.assertClean(hireeHandle.issues, 'hired candidate')
  },
}
