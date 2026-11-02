import { applyApi, completeCandidate, recruiterWithJob } from '../lib/applicants.js'
import { clickText, fill, pageApi, signInWithForm } from '../lib/flows.js'
import { TEST_PASSWORD, api, db } from '../lib/testApi.js'

const names = async (page) => (await pageApi(page, '/recruiter/pipeline')).body.items.map((stage) => stage.name)
const alertOf = (page, selector) => page.waitForFunction((query) => document.querySelector(query)?.textContent, { timeout: 10_000 }, selector).then((handle) => handle.jsonValue())

/** Types a new stage name and presses Add. */
async function addStage(page, name) {
  await fill(page, 'input[name="stageName"]', name)
  await clickText(page, 'Add', '[role="dialog"] button[type="submit"]')
}

/**
 * P6-07 (M-072, OD5): add "Portfolio review" (screening by default), rename it, move it up ("Applied" stays first).
 * Removing a stage with active applications is blocked; a 13th stage, a 25-character name and a duplicate (any case)
 * are refused. History keeps the old stage names.
 */
export default {
  name: 'P6-07 Manage stages',
  viewports: ['D', 'M'],
  async run(ctx) {
    const { recruiter, job } = await recruiterWithJob(`Pipeline${ctx.viewport}`)
    const handle = await ctx.newPage()
    const { page } = handle
    await signInWithForm(page, ctx.webUrl, '/recruiter/sign-in', recruiter.email, TEST_PASSWORD)
    await page.goto(`${ctx.webUrl}/recruiter/hiring-pipeline/manage-stage`, { waitUntil: 'networkidle0' })
    await page.waitForSelector('[data-stage="Applied"]')

    await addStage(page, 'Portfolio review')
    await page.waitForSelector('[data-stage="Portfolio review"]')
    ctx.check((await page.$eval('[data-stage="Portfolio review"] select', (select) => select.value)) === 'screening', 'a new stage is "Under review (screening)"')
    await fill(page, '[data-stage="Portfolio review"] input', 'Portfolio check')
    await page.keyboard.press('Enter')
    await page.waitForFunction(async () => {
      const response = await fetch('/api/v1/recruiter/pipeline', { headers: { Authorization: `Bearer ${localStorage.getItem('lwm-auth-token')}` } })
      return (await response.json()).items.some((stage) => stage.name === 'Portfolio check')
    })
    // The list refetches after the rename; click once the renamed row is on screen.
    const up = await page.waitForSelector('[data-stage="Portfolio check"] button[aria-label="Move Portfolio check up"]')
    await up.click()
    await page.waitForFunction(() => [...document.querySelectorAll('[data-stage]')].at(-2)?.dataset.stage === 'Portfolio check')
    const order = await names(page)
    ctx.check(order[0] === 'Applied' && order.at(-2) === 'Portfolio check', `reordered, Applied first: ${order.join(', ')}`)
    ctx.check(await page.$eval('[data-stage="Applied"] button[aria-label="Move Applied up"]', (button) => button.disabled), 'Applied cannot move')

    await addStage(page, 'x'.repeat(25))
    ctx.check((await alertOf(page, 'form [role="alert"]')).includes('at most 24'), 'a 25-character name is refused')
    await addStage(page, 'APPLIED')
    ctx.check((await alertOf(page, 'form [role="alert"]')).includes('already in the list'), 'a duplicate in another case is refused')
    await handle.checkOverflow()
    await ctx.screenshot(page, '1-manage-stages')
    ctx.assertClean(handle.issues.filter((issue) => !issue.includes('HTTP 422')), 'manage stages')
    if (ctx.viewport !== 'D') return

    // A stage with an active application cannot be removed.
    const candidate = await completeCandidate('StageUser')
    const { body: application } = await applyApi(candidate.token, job.id)
    const pipeline = (await pageApi(page, '/recruiter/pipeline')).body.items
    const screening = pipeline.find((stage) => stage.name === 'Screening')
    await api(`/recruiter/applications/${application.id}/stage`, { method: 'PATCH', token: recruiter.token, body: { stageId: screening.id } })
    await page.reload({ waitUntil: 'networkidle0' })
    await page.click('[data-stage="Screening"] button[aria-label="Remove Screening"]')
    ctx.check((await alertOf(page, '[data-stage="Screening"] [role="alert"]')).includes('1 active application is in this stage'), 'removal blocked while an application sits there')

    // History keeps the old name after a rename.
    await fill(page, '[data-stage="Screening"] input', 'Phone screen')
    await page.keyboard.press('Enter')
    await page.waitForSelector('[data-stage="Phone screen"]')
    const [stored] = await db('applications', 'find', { filter: { _id: { $oid: application.id } } })
    ctx.check(stored.history.map((step) => step.stageName).join(',') === 'Applied,Screening', `history keeps "Screening" (${stored.history.map((step) => step.stageName)})`)

    // Up to 12 stages: 7 now, 5 more, then the 13th is refused.
    for (let n = 1; n <= 5; n++) await api('/recruiter/pipeline/stages', { method: 'POST', token: recruiter.token, body: { name: `Extra ${n}` } })
    await page.reload({ waitUntil: 'networkidle0' })
    await addStage(page, 'One too many')
    ctx.check((await alertOf(page, 'form [role="alert"]')).includes('at most 12 stages'), 'a 13th stage is refused')
    ctx.check((await names(page)).length === 12, '12 stages remain')
    await ctx.screenshot(page, '2-limits')
    // The refused requests answer 409 and 422 on purpose.
    ctx.assertClean(handle.issues.filter((issue) => !/HTTP 4(09|22)/.test(issue)), 'stage rules')
  },
}
