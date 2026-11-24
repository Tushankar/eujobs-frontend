import { approvedAgency, dayFromToday, publishAgreement } from '../lib/agencies.js'
import { uploadAs } from '../lib/candidates.js'
import { fixture } from '../fixtures/make.js'
import { bodyText, fill, signInWithForm, waitForText } from '../lib/flows.js'
import { jobBody, postJob } from '../lib/recruiters.js'
import { api, TEST_PASSWORD } from '../lib/testApi.js'

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * P15-05 (owner 2026-11-23): the agency's guided setup (Overview, empty Jobs and Placements: client first, then the
 * agreement, a job, the books, a placement), the redesigned Agency terms step (client picker with "Add a client",
 * calendar date pickers, quick lengths, pay and hours with a weekly estimate, the rules for this job from the agreement
 * and the job's contract, the aligned rules editor) and the AI marks in the wizard's step list after a draft.
 */
export default {
  name: 'P15-05 Agency setup flow and terms',
  viewports: ['D', 'M'],
  async run(ctx) {
    const phone = ctx.viewport === 'M'
    const agency = await approvedAgency('P1505')
    const handle = await ctx.newPage()
    const { page } = handle
    await signInWithForm(page, ctx.webUrl, '/agencies/login', agency.email, TEST_PASSWORD)

    // 1. A new agency: the setup asks for a client first everywhere.
    await page.goto(`${ctx.webUrl}/agency`, { waitUntil: 'networkidle0' })
    await page.waitForSelector('[data-agency-setup]')
    ctx.check((await page.$eval('[data-agency-setup]', (card) => card.dataset.agencySetup)) === 'client', 'the next step of a new agency is its first client')
    const locked = await page.$eval('[data-setup-step="job"]', (row) => row.innerText)
    ctx.check(locked.includes('Add a client first'), 'posting a job waits for a client')
    await handle.checkOverflow()
    await ctx.screenshot(page, '1-overview-setup')
    await page.goto(`${ctx.webUrl}/agency/jobs`, { waitUntil: 'networkidle0' })
    await waitForText(page, 'Post your first agency job')
    await ctx.screenshot(page, '2-jobs-empty')
    await page.goto(`${ctx.webUrl}/agency/placements`, { waitUntil: 'networkidle0' })
    await waitForText(page, 'No placements yet')
    await ctx.screenshot(page, '3-placements-empty')

    // 2. A client and the agreement: the setup moves on to the job.
    const acme = (await api('/agency/clients', { method: 'POST', token: agency.token, body: { name: 'Acme Ports', sector: 'logistics_transport' } })).body
    await api('/agency/clients', { method: 'POST', token: agency.token, body: { name: 'Northwind Retail', sector: 'retail_ecommerce' } })
    await publishAgreement(agency.token)
    await page.goto(`${ctx.webUrl}/agency`, { waitUntil: 'networkidle0' })
    await page.waitForSelector('[data-agency-setup="job"]')
    ctx.check(true, 'after a client and the agreement the next step is the job')

    // 3. The Agency terms step of a draft.
    const draft = await postJob(agency.token, jobBody({ title: 'Crane Operator', agency: { clientId: acme.id, showClient: true, startDate: dayFromToday(10), endDate: dayFromToday(20), rate: { amountMinor: 1650, period: 'hour' } } }), { draft: true })
    await page.goto(`${ctx.webUrl}/agency/jobs/${draft.id}/edit?step=6`, { waitUntil: 'networkidle0' })
    await page.waitForSelector('[data-client-picker]')
    ctx.check((await page.$eval('[data-client-picker]', (button) => button.innerText)).includes('Acme Ports'), 'the picker shows the chosen client')
    const rules = await page.$eval('[data-job-rules]', (card) => card.innerText)
    ctx.check(rules.includes('version 1') && rules.includes('From the agency agreement'), 'the rules for this job come from the agreement')
    await handle.checkOverflow()
    await ctx.screenshot(page, '4-terms')

    await page.click('[data-client-picker]')
    await page.waitForSelector('[data-client-option="Northwind Retail"]')
    await ctx.screenshot(page, '5-client-picker')
    await page.click('[data-client-option="Northwind Retail"]')
    await page.click('[data-segmented="showClient"] [role="radio"]:last-child')
    ctx.check((await page.$eval('[data-client-shown]', (line) => line.innerText)).includes('Candidates see: For a confidential client'), 'confidential shows as such')

    await page.click('[data-date-picker="startDate"]')
    await page.waitForSelector('[role="grid"] [data-day]')
    await pause(400)
    await ctx.screenshot(page, '6-calendar')
    await page.keyboard.press('Escape')
    await page.click('[data-length="month"]')
    await page.waitForSelector('[data-length-text]')
    const length = await page.$eval('[data-length-text]', (line) => line.innerText)
    ctx.check(/week/.test(length), `a month from the start reads as weeks (${length})`)
    await fill(page, 'input[name="hoursPerWeek"]', '38')
    await page.waitForSelector('[data-weekly-pay]')
    ctx.check((await page.$eval('[data-weekly-pay]', (line) => line.innerText)).includes('38 hours'), 'the weekly estimate uses the hours')
    if (!phone) {
      const preview = await page.$eval('[data-preview-agency]', (list) => list.innerText)
      ctx.check(preview.includes('38 hours a week'), 'the side preview shows the hours')
    }
    await page.$eval('[data-job-rules]', (card) => card.scrollIntoView({ block: 'start' }))
    await pause(300)
    await ctx.screenshot(page, '7-terms-filled')

    // 4. The aligned rules editor of the job's own contract.
    await uploadAs(agency.token, `/recruiter/jobs/${draft.id}/contract`, fixture('agency-agreement.pdf'), 'application/pdf')
    await page.reload({ waitUntil: 'networkidle0' })
    await page.waitForSelector('[data-rules-editor] [data-rule-editor="noticeDays"]')
    const clauses = await page.$$eval('[data-rules-editor] textarea', (areas) => areas.length)
    ctx.check(clauses === 0, `no empty clause boxes while every rule is "Not stated" (${clauses})`)
    await fill(page, '[data-rule-editor="noticeDays"] input', '7')
    await page.waitForSelector('[data-rule-editor="noticeDays"] textarea')
    await page.$eval('[data-rules-editor]', (editor) => editor.scrollIntoView({ block: 'start' }))
    await pause(300)
    await handle.checkOverflow()
    await ctx.screenshot(page, '8-rules-editor')

    // 5. The AI draft marks the steps it filled (real OpenAI).
    if (!phone) {
      await page.goto(`${ctx.webUrl}/agency/jobs/new`, { waitUntil: 'networkidle0' })
      await fill(page, 'input[name="title"]', 'Warehouse Picker')
      await fill(page, '[data-job-ai-draft] textarea', 'Two weeks of day shifts for Acme Ports, 13.20 an hour, 37.5 hours a week, scanner experience helps.')
      await page.click('[data-job-ai-draft-button]')
      await page.waitForSelector('[data-job-ai-filled], [data-job-ai-draft] [data-ai-state]:not([data-ai-state="loading"])', { timeout: 90_000 })
      const aiState = await page.$eval('[data-job-ai-draft]', (panel) => panel.querySelector('[data-ai-state]:not([data-ai-state="loading"])')?.innerText ?? null)
      if (aiState) throw new Error(`the job post writer failed: ${aiState}`)
      const marked = await page.$$eval('[data-ai-step]', (marks) => marks.map((mark) => mark.dataset.aiStep))
      ctx.check(marked.includes('responsibilities') && marked.includes('agency'), `the step list marks the AI steps (${marked.join(', ')})`)
      ctx.check(Boolean(await page.$('[data-job-ai-preview]')), 'the draft is previewed')
      await ctx.screenshot(page, '9-ai-marks')
    }
    ctx.check((await bodyText(page)).length > 0, 'page rendered')
    ctx.assertClean(handle.issues, 'agency flow and terms')
  },
}
