import { applyApi, chooseStage, completeCandidate, MINUTE, recruiterWithJob, tickIn } from '../lib/applicants.js'
import { clickText, signInWithForm, toggleCheckbox } from '../lib/flows.js'
import { TEST_PASSWORD, mailTo } from '../lib/testApi.js'

/** "Not selected" on a card or row, then the confirm dialog with "Email the candidate" as `notify`. */
async function reject(page, select, notify) {
  await chooseStage(page, select, 'Not selected')
  // The DS checkbox's native input is visually hidden; its label is what shows.
  await page.waitForSelector('[role="dialog"] label:has(input[name="notify"])', { visible: true })
  const checked = await page.$eval('input[name="notify"]', (input) => input.checked)
  if (checked !== notify) await toggleCheckbox(page, 'notify')
  await clickText(page, 'Mark as not selected', '[role="dialog"] button')
  await page.waitForSelector('[role="dialog"]', { hidden: true })
  return checked
}

/**
 * P6-05 (M-090, U33, OQ-6e): reject with the box checked (the default) → the card leaves the board and shows under
 * "Not selected". Choosing a stage again within 10 minutes → no email; rejecting with the box unchecked → no email;
 * rejecting with it checked → after 10 minutes the email arrives in the candidate's language (Spanish).
 */
export default {
  name: 'P6-05 Reject and undo',
  viewports: ['D', 'M'],
  async run(ctx) {
    const { recruiter, job } = await recruiterWithJob(`Reject${ctx.viewport}`)
    const candidate = await completeCandidate(`Rechazo${ctx.viewport}`, { language: 'es' })
    const { body: application } = await applyApi(candidate.token, job.id)
    const emails = async () => [...(await mailTo(candidate.email, 'application_rejected')), ...(await mailTo(candidate.email, 'application_status'))]

    const handle = await ctx.newPage()
    const { page } = handle
    await signInWithForm(page, ctx.webUrl, '/recruiter/sign-in', recruiter.email, TEST_PASSWORD)
    await page.goto(`${ctx.webUrl}/recruiter/hiring-pipeline`, { waitUntil: 'networkidle0' })
    const card = `[data-application="${application.id}"]`
    await page.waitForSelector(`[data-column="Applied"] ${card}`)
    const checkedByDefault = await reject(page, `${card} select`, true)
    ctx.check(checkedByDefault, '"Email the candidate" is checked by default')
    await page.waitForSelector(card, { hidden: true })
    await handle.checkOverflow()
    await ctx.screenshot(page, '1-board-after-reject')

    await page.goto(`${ctx.webUrl}/recruiter/applications?stage=not_selected`, { waitUntil: 'networkidle0' })
    const row = `[data-stage-select="${application.id}"] select`
    await page.waitForSelector(row)
    ctx.check((await page.$eval(row, (select) => select.value)) === 'not_selected', 'listed under "Not selected"')
    await handle.checkOverflow()
    await ctx.screenshot(page, '2-not-selected-filter')
    ctx.assertClean(handle.issues, 'reject')
    if (ctx.viewport !== 'D') return

    // Undo inside the window: choose a stage again.
    await chooseStage(page, row, 'Applied')
    await page.waitForSelector(row, { hidden: true })
    await tickIn(11 * MINUTE)
    ctx.check((await emails()).length === 0, 'undo within 10 minutes: no email')

    await page.goto(`${ctx.webUrl}/recruiter/applications`, { waitUntil: 'networkidle0' })
    await page.waitForSelector(row)
    await reject(page, row, false)
    await page.waitForSelector(row, { hidden: true })
    await tickIn(11 * MINUTE)
    ctx.check((await emails()).length === 0, 'rejected with the box unchecked: no email')

    await page.goto(`${ctx.webUrl}/recruiter/applications?stage=not_selected`, { waitUntil: 'networkidle0' })
    await chooseStage(page, row, 'Applied')
    await page.waitForSelector(row, { hidden: true })
    await page.goto(`${ctx.webUrl}/recruiter/applications`, { waitUntil: 'networkidle0' })
    await page.waitForSelector(row)
    await reject(page, row, true)
    await tickIn(9 * MINUTE)
    ctx.check((await emails()).length === 0, 'nothing before the 10 minutes')
    await tickIn(11 * MINUTE)
    const [mail] = await mailTo(candidate.email, 'application_rejected')
    ctx.check(mail?.language === 'es' && mail.subject === `Novedades sobre tu candidatura a ${job.title}`, `the rejection email in Spanish (${mail?.language}: ${mail?.subject})`)
    ctx.check((await emails()).length === 1, 'exactly one email in all')
    ctx.note(`rejection email: ${mail.subject}`)
    ctx.assertClean(handle.issues, 'undo and emails')
  },
}
