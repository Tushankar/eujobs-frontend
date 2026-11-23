import { approvedAgency, dayFromToday, publishAgreement } from '../lib/agencies.js'
import { completeCandidate } from '../lib/applicants.js'
import { uploadAs } from '../lib/candidates.js'
import { fixture } from '../fixtures/make.js'
import { bodyText, clickText, signInWithForm, waitForText } from '../lib/flows.js'
import { jobBody, postJob } from '../lib/recruiters.js'
import { api, date, db, TEST_PASSWORD } from '../lib/testApi.js'

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const NONE = { value: null, clause: null }

/**
 * P15-07 (owner 2026-11-23: "proper flow testing for agencies and candidates"): what happens after a placement, through
 * the real screens on both sides. The agency ends a running placement early (calendar), offers a re-hire after one that
 * is over; the candidate declines it; the agency publishes agreement version 2 and the candidate agrees to it again; a
 * job with its own confirmed contract shows "From the job contract" before applying; the candidate leaves the agency.
 * Problems are notes (ISSUE: …); it fails only where the next step cannot happen.
 */
export default {
  name: 'P15-07 Agency lifecycle',
  viewports: ['D', 'M'],
  async run(ctx) {
    const issue = (text) => ctx.note(`ISSUE: ${text}`)
    const expect = (ok, text) => (ok ? ctx.note(`ok: ${text}`) : issue(text))

    // ---- Setup through the API: an agency with its agreement, a candidate on its books on a running placement ----
    const agency = await approvedAgency('P1507')
    await publishAgreement(agency.token)
    const company = (await api('/me', { token: agency.token })).body.company
    const acme = (await api('/agency/clients', { method: 'POST', token: agency.token, body: { name: 'Acme Ports' } })).body
    const terms = (start, end) => ({ clientId: acme.id, showClient: true, startDate: dayFromToday(start), endDate: dayFromToday(end), rate: { amountMinor: 1500, period: 'hour' } })
    const running = await postJob(agency.token, jobBody({ title: 'Packing Cover', agency: terms(0, 30) }))
    const nextJob = await postJob(agency.token, jobBody({ title: 'Night Shift Lead', agency: terms(40, 60) }))
    const contractJob = await postJob(agency.token, jobBody({ title: 'Dock Loader', agency: terms(70, 90) }), { draft: true })
    await uploadAs(agency.token, `/recruiter/jobs/${contractJob.id}/contract`, fixture('agency-agreement.pdf'), 'application/pdf')
    const confirmed = await api(`/recruiter/jobs/${contractJob.id}/contract/rules`, {
      method: 'PUT',
      token: agency.token,
      body: { exclusivity: { value: 'free', clause: null }, noticeDays: { value: 7, clause: 'Either party may end an Assignment by giving seven days of written notice.' }, coolingOffDays: NONE, maxWeeklyHours: NONE },
    })
    expect(confirmed.status === 200, `the job contract's rules are confirmed (${confirmed.status})`)
    await api(`/recruiter/jobs/${contractJob.id}/status`, { method: 'PATCH', token: agency.token, body: { status: 'published' } })

    const candidate = await completeCandidate('P1507C', { plus: false })
    const now = date(Date.now())
    await db('subscriptions', 'insertOne', { doc: { userId: { $oid: candidate.id }, planKey: 'plus', status: 'active', retrying: false, currency: 'GBP', amountMinor: 999, cancelAtPeriodEnd: false, source: 'stripe', startedAt: now, createdAt: now, updatedAt: now } })
    const joined = (await api(`/candidate/agencies/${company.id}/join`, { method: 'POST', token: candidate.token })).body
    await api(`/agency/talent/${joined.id}/accept`, { method: 'POST', token: agency.token })
    await api(`/candidate/agencies/memberships/${joined.id}/agree`, { method: 'POST', token: candidate.token, body: { version: 1 } })
    const [entry] = await db('pipelinestages', 'find', { filter: { companyId: { $oid: company.id }, isEntry: true } })
    const [hired] = await db('pipelinestages', 'find', { filter: { companyId: { $oid: company.id }, category: 'hired' } })
    await db('applications', 'insertOne', { doc: { candidateId: { $oid: candidate.id }, jobId: { $oid: running.id }, companyId: { $oid: company.id }, stageId: entry._id, status: 'applied', consentAt: now, appliedAt: now, history: [{ status: 'applied', at: now, actorType: 'candidate' }], createdAt: now, updatedAt: now } })
    const [application] = await db('applications', 'find', { filter: { candidateId: { $oid: candidate.id }, jobId: { $oid: running.id } } })
    const moved = await api(`/recruiter/applications/${application._id.$oid ?? application._id}/stage`, { method: 'PATCH', token: agency.token, body: { stageId: hired._id.$oid ?? hired._id } })
    expect(moved.status === 200, `hired on the running job (${moved.status})`)
    // An earlier placement that is over, for the re-hire.
    await db('agencyplacements', 'insertOne', {
      doc: {
        companyId: { $oid: company.id }, candidateId: { $oid: candidate.id }, jobId: { $oid: running.id }, status: 'confirmed',
        startDate: dayFromToday(-40), endDate: dayFromToday(-10), hoursPerWeek: 40,
        rules: { exclusivity: { value: 'no_other_agency_work' }, noticeDays: { value: null }, coolingOffDays: { value: null }, maxWeeklyHours: { value: null } },
        sources: { exclusivity: 'default' }, confirmedAt: now, createdAt: now, updatedAt: now,
      },
    })

    const handle = await ctx.newPage()
    const { page } = handle
    await signInWithForm(page, ctx.webUrl, '/agencies/login', agency.email, TEST_PASSWORD)

    // ---- 1. The agency ends the running placement early, with the calendar ----
    await page.goto(`${ctx.webUrl}/agency/placements?tab=running`, { waitUntil: 'networkidle0' })
    await page.waitForSelector(`[data-placement="${candidate.fullName}"]`, { timeout: 10_000 }).catch(() => issue('the running placement is not under Running'))
    await ctx.screenshot(page, '01-running')
    await clickText(page, 'End early', `[data-placement="${candidate.fullName}"] button`)
    await page.waitForSelector('[data-date-picker="endDate"]')
    await page.click('[data-date-picker="endDate"]')
    await page.waitForSelector('[role="grid"] [data-day]')
    for (let index = 0; index < 3; index += 1) await page.keyboard.press('ArrowRight')
    await page.keyboard.press('Enter')
    await pause(300)
    await ctx.screenshot(page, '02-end-early-dialog')
    await clickText(page, 'End early', '[role="dialog"] button')
    await pause(1200)
    const runningText = await page.$eval(`[data-placement="${candidate.fullName}"]`, (row) => row.innerText).catch(() => '')
    ctx.note(`running row after ending early: ${runningText.replace(/\s+/g, ' ')}`)
    await handle.checkOverflow()
    await ctx.screenshot(page, '03-ended-early')

    // ---- 2. The agency offers a re-hire after the placement that is over ----
    await page.goto(`${ctx.webUrl}/agency/placements?tab=over`, { waitUntil: 'networkidle0' })
    await page.waitForSelector(`[data-placement="${candidate.fullName}"]`, { timeout: 10_000 }).catch(() => issue('the finished placement is not under Over'))
    await clickText(page, 'Re-hire', `[data-placement="${candidate.fullName}"] button`)
    await page.waitForSelector('[role="dialog"] select')
    const options = await page.$$eval('[role="dialog"] select option', (items) => items.map((item) => item.textContent))
    ctx.note(`re-hire job choices: ${options.join(', ')}`)
    await page.select('[role="dialog"] select', nextJob.id).catch(() => issue('Night Shift Lead is not offered for the re-hire'))
    await ctx.screenshot(page, '04-rehire-dialog')
    await clickText(page, 'Send offer', '[role="dialog"] button')
    await pause(1200)
    await page.goto(`${ctx.webUrl}/agency/placements?tab=offered`, { waitUntil: 'networkidle0' })
    expect((await bodyText(page)).includes('Night Shift Lead'), 'the offer is under Offers')
    await ctx.screenshot(page, '05-offers')

    // ---- 3. The candidate declines the offer ----
    const seeker = await ctx.newPage()
    await signInWithForm(seeker.page, ctx.webUrl, '/sign-in', candidate.email, TEST_PASSWORD)
    await seeker.page.goto(`${ctx.webUrl}/candidate/agencies?tab=offers`, { waitUntil: 'networkidle0' })
    await seeker.page.waitForSelector('[data-view-offer]', { timeout: 10_000 }).catch(() => issue('the candidate has no offer to view'))
    await ctx.screenshot(seeker.page, '06-candidate-offers')
    await seeker.page.click('[data-view-offer]')
    await waitForText(seeker.page, 'Rules if you accept').catch(() => issue('the offer does not show its rules'))
    await ctx.screenshot(seeker.page, '07-candidate-offer')
    await clickText(seeker.page, 'Decline', '[role="dialog"] button')
    await pause(1200)
    await ctx.screenshot(seeker.page, '08-candidate-declined')
    await page.goto(`${ctx.webUrl}/agency/notifications`, { waitUntil: 'networkidle0' })
    await pause(500)
    expect(/declined/i.test(await bodyText(page)), 'the agency is told the offer was declined')
    await ctx.screenshot(page, '09-agency-bell-declined')

    // ---- 4. Agreement version 2: the candidate agrees again ----
    await publishAgreement(agency.token)
    await seeker.page.goto(`${ctx.webUrl}/candidate/agencies?tab=agencies`, { waitUntil: 'networkidle0' })
    await pause(500)
    const myAgencies = await bodyText(seeker.page)
    expect(myAgencies.includes('Version 2 is waiting for your agreement'), 'My agencies says version 2 waits for agreement')
    await ctx.screenshot(seeker.page, '10-candidate-new-version')
    await clickText(seeker.page, 'Read version 2', 'a').catch(() => issue('no "Read version 2" link'))
    await seeker.page.waitForSelector('[data-agree]', { timeout: 10_000 })
    await seeker.page.$eval('input[name="agree"]', (box) => box.click())
    await seeker.page.click('[data-agree]')
    await pause(1200)
    await ctx.screenshot(seeker.page, '11-candidate-agreed-v2')

    // ---- 5. A job with its own contract: the candidate sees where each rule comes from ----
    await seeker.page.goto(`${ctx.webUrl}/candidate/jobs/${contractJob.id}`, { waitUntil: 'networkidle0' })
    await seeker.page.waitForSelector('[data-placement-rules]', { timeout: 10_000 }).catch(() => issue('no "Before you apply" on the contract job'))
    const rules = await seeker.page.$eval('[data-placement-rules]', (section) => section.innerText).catch(() => '')
    expect(rules.includes('From the job contract'), 'the job contract is named as the source of its rules')
    expect(rules.includes('free to take other work'), 'the contract\'s "free" exclusivity is in plain words')
    await seeker.page.$eval('[data-placement-rules]', (section) => section.scrollIntoView({ block: 'start' })).catch(() => {})
    await pause(300)
    await seeker.checkOverflow()
    await ctx.screenshot(seeker.page, '12-candidate-contract-rules')

    // ---- 6. The candidate leaves the agency ----
    await seeker.page.goto(`${ctx.webUrl}/candidate/agencies?tab=agencies`, { waitUntil: 'networkidle0' })
    await clickText(seeker.page, 'Leave', 'button')
    await pause(300)
    await ctx.screenshot(seeker.page, '13-candidate-leave-confirm')
    await clickText(seeker.page, 'Leave', '[role="dialog"] button')
    await pause(1200)
    expect((await bodyText(seeker.page)).includes('Left'), 'My agencies shows the agency as left')
    await ctx.screenshot(seeker.page, '14-candidate-left')
    await seeker.page.goto(`${ctx.webUrl}/candidate/jobs/${nextJob.id}`, { waitUntil: 'networkidle0' })
    await seeker.page.waitForSelector('[data-eligibility]', { timeout: 10_000 }).catch(() => {})
    expect((await seeker.page.$eval('[data-eligibility]', (box) => box.dataset.eligibility).catch(() => null)) === 'todo', 'after leaving, an agency job says to join the books again')
    await ctx.screenshot(seeker.page, '15-candidate-after-leaving')
    await page.goto(`${ctx.webUrl}/agency/talent`, { waitUntil: 'networkidle0' })
    await pause(500)
    expect(!(await bodyText(page)).includes(candidate.fullName), 'the agency no longer lists them on its books')
    await ctx.screenshot(page, '16-agency-talent-after')
    await page.goto(`${ctx.webUrl}/agency/placements?tab=running`, { waitUntil: 'networkidle0' })
    await pause(500)
    expect((await bodyText(page)).includes(candidate.fullName), 'the running placement continues after they leave')
    await ctx.screenshot(page, '17-agency-running-after')
    ctx.note(`page issues: ${[...handle.issues, ...seeker.issues].join(' | ') || 'none'}`)
  },
}
