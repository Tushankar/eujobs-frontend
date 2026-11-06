import { chooseStage } from '../lib/applicants.js'
import { seedCredentials } from '../lib/env.js'
import { responseTo, signInWithForm } from '../lib/flows.js'
import { SARAH, seededPair } from '../lib/interviews.js'
import { api } from '../lib/testApi.js'

/** Sarah's stages by name, and the interviews of Emma's application that are still under way. */
async function state(pair) {
  const stages = Object.fromEntries((await api('/recruiter/pipeline', { token: pair.sarah })).body.items.map((stage) => [stage.name, stage.id]))
  const { cards } = (await api(`/conversations/${pair.threadId}/messages`, { token: pair.sarah })).body
  const active = cards.interviews.filter((item) => item.applicationId === pair.applicationId && ['offered', 'other_times', 'confirmed', 'expired'].includes(item.status))
  return { stages, active }
}

/**
 * P11d-07 (owner answer P11d-A6): the pipeline and interviews stay consistent. Moving Emma's card into Interview opens
 * the schedule dialog; the card and the panel show the interview's state; moving the card out of Interview asks
 * "Cancel the interview too?" and cancels it; the Applications row schedules too, and rejecting with an interview under
 * way offers to cancel it as well (D).
 */
export default {
  name: 'P11d-07 Pipeline and interviews',
  viewports: ['D', 'M'],
  async run(ctx) {
    const pair = await seededPair()
    const before = await state(pair)
    for (const item of before.active) await api(`/interviews/${item.id}/cancel`, { method: 'POST', token: pair.sarah, body: {} })
    // Choosing a stage again also undoes an earlier rejection (OQ-6e).
    await api(`/recruiter/applications/${pair.applicationId}/stage`, { method: 'PATCH', token: pair.sarah, body: { stageId: before.stages.Screening } })

    const handle = await ctx.newPage()
    const { page } = handle
    await signInWithForm(page, ctx.webUrl, '/recruiter/sign-in', SARAH(), seedCredentials.password)
    await page.goto(`${ctx.webUrl}/recruiter/hiring-pipeline`, { waitUntil: 'networkidle0' })
    const select = `[data-application="${pair.applicationId}"] [data-stage-select="${pair.applicationId}"] select`
    await page.waitForSelector(select)

    // Into Interview: the move happens and the schedule dialog opens.
    const moved = responseTo(page, `/recruiter/applications/${pair.applicationId}/stage`, 'PATCH')
    await chooseStage(page, select, 'Interview')
    await moved
    await page.waitForSelector('[role="dialog"] [data-slot-row]')
    const offered = responseTo(page, '/api/v1/interviews', 'POST')
    await page.click('[data-offer-submit]')
    const interview = await (await offered).json()
    await page.waitForSelector(`[data-application="${pair.applicationId}"] [data-interview-status-line="offered"]`)
    await handle.checkOverflow()
    await ctx.screenshot(page, '1-card-times-offered')

    // The panel shows it; no second Schedule button while one is under way.
    await page.click(`[data-application="${pair.applicationId}"] button`)
    await page.waitForSelector(`[data-applicant-panel="${pair.applicationId}"] [data-interview-status-line="offered"]`)
    ctx.check(!(await page.$(`[data-applicant-panel] [data-schedule-application]`)), 'no Schedule button while an interview is under way')
    await ctx.screenshot(page, '2-panel')
    await page.keyboard.press('Escape')

    // Out of Interview: asked, and the interview is cancelled too.
    await chooseStage(page, select, 'Shortlisted')
    await page.waitForSelector('[role="dialog"] [data-move-cancel]')
    const cancelled = responseTo(page, `/interviews/${interview.id}/cancel`, 'POST')
    await page.click('[data-move-cancel]')
    ctx.check((await cancelled).status() === 200, 'the interview is cancelled')
    await page.waitForFunction((id) => !document.querySelector(`[data-application="${id}"] [data-interview-status-line="offered"]`), {}, pair.applicationId)
    ctx.check((await state(pair)).active.length === 0, 'no interview under way after the move')
    ctx.assertClean(handle.issues, 'pipeline')
    if (ctx.viewport !== 'D') return

    // From the Applications row, then Not selected with "Also cancel the interview".
    await page.goto(`${ctx.webUrl}/recruiter/applications`, { waitUntil: 'networkidle0' })
    await page.click(`[data-schedule-application="${pair.applicationId}"]`)
    await page.waitForSelector('[role="dialog"] [data-slot-row]')
    const again = responseTo(page, '/api/v1/interviews', 'POST')
    await page.click('[data-offer-submit]')
    const second = await (await again).json()
    await page.waitForSelector('[data-interview-status-line="offered"]')
    const rowSelect = `[data-stage-select="${pair.applicationId}"] select`
    await page.select(rowSelect, 'not_selected')
    await page.waitForSelector('[role="dialog"] input[name="cancelInterview"]')
    ctx.check(await page.$eval('[role="dialog"] input[name="cancelInterview"]', (input) => input.checked), '"Also cancel the interview" is ticked by default')
    await ctx.screenshot(page, '3-reject-dialog')
    const rejected = responseTo(page, `/recruiter/applications/${pair.applicationId}/reject`, 'POST')
    await page.click('[role="dialog"] footer button:last-child')
    await rejected
    const stored = (await api(`/interviews/${second.id}`, { token: pair.sarah })).body
    ctx.check(stored?.status === 'cancelled', `the interview is cancelled with the rejection (${stored?.status})`)
    ctx.assertClean(handle.issues, 'applications')
    // Leave Emma's application active for other scenarios (choosing a stage undoes the rejection).
    await api(`/recruiter/applications/${pair.applicationId}/stage`, { method: 'PATCH', token: pair.sarah, body: { stageId: before.stages.Screening } })
  },
}
