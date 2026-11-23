import { approvedAgency, dayFromToday, publishAgreement } from '../lib/agencies.js'
import { clickApply, completeCandidate } from '../lib/applicants.js'
import { bodyText, clickText, responseTo, waitForText } from '../lib/flows.js'
import { openAs } from '../lib/payments.js'
import { jobBody, postJob } from '../lib/recruiters.js'
import { api, date, db, mailTo } from '../lib/testApi.js'

/**
 * P15-02 (agencies, phase 5): the candidate side. A visitor's /jobs Agency tab; Find jobs' Job type filter and agency
 * cards (client or "confidential client", dates, pay rate); applying with "Also ask to join the books"; the agency
 * accepts, the candidate reads the agreement page (PDF, rules) and agrees; hired, the placement shows on Agencies and
 * blocks another agency's overlapping job ("Free from", the banner with the clause); notice frees it; a re-hire offer
 * is accepted. The bell and the emails along the way. Desktop and phone, Agencies in dark.
 */
const RATE = '£14.50 per hour'

export default {
  name: 'P15-02 Agency jobs and placements for candidates',
  viewports: ['D', 'M'],
  async run(ctx) {
    const phone = ctx.viewport === 'M'

    // Setup: agency A (Acme shown, a second client confidential) and agency B (an overlapping job), both with agreements.
    const agencyA = await approvedAgency('P1502A')
    await publishAgreement(agencyA.token)
    const companyA = (await api('/me', { token: agencyA.token })).body.company
    const acme = (await api('/agency/clients', { method: 'POST', token: agencyA.token, body: { name: 'Acme Logistics' } })).body
    const hidden = (await api('/agency/clients', { method: 'POST', token: agencyA.token, body: { name: 'Hidden Retail' } })).body
    const terms = (clientId, showClient, start, end) => ({ clientId, showClient, startDate: dayFromToday(start), endDate: dayFromToday(end), rate: { amountMinor: 1450, period: 'hour' } })
    const warehouse = await postJob(agencyA.token, jobBody({ title: 'Warehouse Operative', agency: terms(acme.id, true, 3, 33) }))
    const nightPicker = await postJob(agencyA.token, jobBody({ title: 'Night Picker', agency: terms(hidden.id, false, 40, 50) }))

    const agencyB = await approvedAgency('P1502B')
    await publishAgreement(agencyB.token)
    const globex = (await api('/agency/clients', { method: 'POST', token: agencyB.token, body: { name: 'Globex Freight' } })).body
    const forklift = await postJob(agencyB.token, jobBody({ title: 'Forklift Driver', agency: terms(globex.id, true, 10, 20) }))

    // A candidate who passes the apply gate, on Plus (a subscription row, as the agencies' plan).
    const candidate = await completeCandidate('P1502', { plus: false })
    const now = date(Date.now())
    await db('subscriptions', 'insertOne', {
      doc: { userId: { $oid: candidate.id }, planKey: 'plus', status: 'active', retrying: false, currency: 'GBP', amountMinor: 999, cancelAtPeriodEnd: false, source: 'stripe', startedAt: now, createdAt: now, updatedAt: now },
    })

    const handle = await ctx.newPage()
    const { page } = handle

    // 1. A visitor: /jobs has an Agency tab with the agency lines.
    await page.goto(`${ctx.webUrl}/jobs?employmentType=agency`, { waitUntil: 'networkidle0' })
    await waitForText(page, 'Warehouse Operative')
    const visitor = await bodyText(page)
    ctx.check(visitor.includes('For Acme Logistics') && visitor.includes('For a confidential client'), 'public rows: the client or a confidential client')
    ctx.check(visitor.includes(RATE), `public rows: the pay rate (${RATE})`)
    ctx.check(await page.$eval('[role="tab"][aria-selected="true"]', (tab) => tab.textContent.startsWith('Agency')), 'the Agency tab is selected')
    await handle.checkOverflow()
    await ctx.screenshot(page, '1-public-agency-tab')

    // 2. Find jobs › Filters › Job type › Agency: only agency cards, each with its client, dates and rate.
    await openAs(ctx, handle, candidate.email, '/candidate/jobs')
    await page.waitForSelector('article[data-job]')
    await clickText(page, 'Filters', 'button')
    await page.waitForSelector('[role="dialog"]')
    const filtered = responseTo(page, ['/api/v1/jobs?', 'employmentType=agency'])
    await clickText(page, 'Agency', '[role="dialog"] label')
    await filtered
    await clickText(page, 'Show', '[role="dialog"] button')
    const card = (id) => `article[data-job="${id}"]`
    await page.waitForSelector(card(warehouse.id))
    const cards = await page.$$eval('article[data-job]', (items) => items.map((item) => ({ client: item.querySelector('[data-agency-client]')?.textContent ?? null, rate: item.querySelector('[data-agency-rate]')?.textContent ?? null })))
    ctx.check(cards.length >= 3 && cards.every((item) => item.client && item.rate), `every card is an agency job with client and rate (${cards.length})`)
    ctx.check((await page.$eval(card(nightPicker.id), (item) => item.innerText)).includes('For a confidential client'), 'the confidential client card')
    ctx.check((await page.$eval(card(warehouse.id), (item) => item.innerText)).includes(RATE), 'the card shows the pay rate')
    await handle.checkOverflow()
    await ctx.screenshot(page, '2-find-jobs-agency')

    // 3. Job details: the placement terms; apply with "Also ask to join the books".
    await page.goto(`${ctx.webUrl}/candidate/jobs/${warehouse.id}`, { waitUntil: 'networkidle0' })
    await page.waitForSelector('[data-agency-terms]')
    ctx.check((await page.$eval('[data-agency-terms]', (section) => section.innerText)).includes('31 days'), 'details: the dates with their length')
    ctx.check(Boolean(await page.$('[data-join-agency]')), 'details: the Join button')
    await clickApply(page)
    await page.waitForSelector('[data-apply-dialog] [data-join-agency]')
    await page.$eval('[data-apply-dialog] input[name="joinAgency"]', (box) => box.click())
    await page.$eval('[data-apply-dialog] input[name="consent"]', (box) => box.click())
    await ctx.screenshot(page, '3-apply-and-join')
    const joined = responseTo(page, [`/candidate/agencies/${companyA.id}/join`], 'POST')
    await page.click('button[form="apply-form"]')
    ctx.check((await joined).status() === 201, 'applying also asked to join the books')
    await page.waitForSelector('[data-membership="requested"]')
    ctx.check((await bodyText(page)).includes('Request sent'), 'details: "Request sent"')

    // 4. The agency accepts: the bell and an email; Agencies › My agencies asks to read the agreement.
    const membership = (await api('/candidate/agencies', { token: candidate.token })).body.items.find((item) => item.agency.id === companyA.id)
    await api(`/agency/talent/${membership.id}/accept`, { method: 'POST', token: agencyA.token })
    await page.goto(`${ctx.webUrl}/candidate/agencies?tab=agencies`, { waitUntil: 'networkidle0' })
    await page.waitForSelector(`[data-membership="${companyA.displayName}"]`)
    ctx.check((await bodyText(page)).includes('Agreement to read'), 'My agencies: the agreement to read')
    await handle.checkOverflow()
    await ctx.screenshot(page, '4-my-agencies')

    // 5. The agreement page: the PDF, the rules with the clause, "I agree".
    await clickText(page, 'Read agreement', `[data-membership="${companyA.displayName}"] a`)
    await page.waitForSelector('[data-agreement-pdf]')
    const agreement = await bodyText(page)
    ctx.check(agreement.includes('Version 1') && agreement.includes('Either party may end an Assignment by giving seven days of written notice.'), 'agreement: version and the quoted clause')
    ctx.check(agreement.includes(`Signed as ${candidate.fullName}`), 'agreement: signed as the candidate')
    await page.click('[data-agree]')
    await waitForText(page, 'Tick the box to agree.')
    await page.$eval('input[name="agree"]', (box) => box.click())
    await handle.checkOverflow()
    await ctx.screenshot(page, '5-agreement')
    await page.click('[data-agree]')
    await waitForText(page, `You are on ${companyA.displayName}’s books.`)
    // The list refetches after agreeing.
    await waitForText(page, 'On the books')
    ctx.check(true, 'agreed: on the books')

    // 6. Hired: the placement is confirmed (bell, email) and shows under Upcoming with its rules.
    const [hired] = await db('pipelinestages', 'find', { filter: { companyId: { $oid: companyA.id }, category: 'hired' } })
    const [application] = await db('applications', 'find', { filter: { candidateId: { $oid: candidate.id }, jobId: { $oid: warehouse.id } } })
    const moved = await api(`/recruiter/applications/${application._id.$oid ?? application._id}/stage`, { method: 'PATCH', token: agencyA.token, body: { stageId: hired._id.$oid ?? hired._id } })
    ctx.check(moved.status === 200, `hired (${moved.status})`)
    await page.goto(`${ctx.webUrl}/candidate/notifications`, { waitUntil: 'networkidle0' })
    await waitForText(page, 'Your placement as Warehouse Operative')
    ctx.check((await bodyText(page)).includes('accepted your request: read and agree to its agreement'), 'the bell: request accepted and placement confirmed')
    await page.goto(`${ctx.webUrl}/candidate/agencies`, { waitUntil: 'networkidle0' })
    await page.waitForSelector('[data-placement="Warehouse Operative"]')
    ctx.check((await bodyText(page)).includes('Upcoming'), 'Placements: under Upcoming')
    await clickText(page, 'Warehouse Operative', '[data-placement="Warehouse Operative"] button')
    await waitForText(page, 'Rules of this placement')
    const details = await bodyText(page)
    ctx.check(details.includes('From the agency agreement') && details.includes('Acme Logistics') && details.includes(RATE), 'placement details: client, rate and rule sources')
    await ctx.screenshot(page, '6-placement')
    await page.keyboard.press('Escape')

    // 7. Agency B's overlapping job is blocked: the card's "Free from" and the banner with the rule.
    const freeFrom = dayFromToday(34)
    await page.goto(`${ctx.webUrl}/candidate/jobs/${forklift.id}`, { waitUntil: 'networkidle0' })
    await page.waitForSelector('[data-lock-banner]')
    const banner = await page.$eval('[data-lock-banner]', (section) => section.innerText)
    ctx.check(banner.includes('Your placement as Warehouse Operative') && banner.includes('No work through other agencies') && banner.includes('From the agency agreement'), 'the banner names the placement, the rule and its source')
    ctx.check(Boolean(await page.$('[data-apply-locked]')), 'Apply is disabled')
    const check = (await api(`/candidate/placements/check?jobId=${forklift.id}`, { token: candidate.token })).body
    ctx.check(check.freeFrom === freeFrom, `free from the day after the placement (${check.freeFrom})`)
    await handle.checkOverflow()
    await ctx.screenshot(page, '7-locked-job')

    // 8. Notice (7 days): the placement now ends sooner, and the overlapping job opens.
    await page.goto(`${ctx.webUrl}/candidate/agencies`, { waitUntil: 'networkidle0' })
    await page.click('[data-placement="Warehouse Operative"] [data-give-notice]')
    await page.waitForSelector('[data-notice-last-day]')
    ctx.check((await bodyText(page)).includes('Either party may end an Assignment by giving seven days of written notice.'), 'notice: the clause')
    await ctx.screenshot(page, '8-notice')
    await page.click('[data-confirm-notice]')
    await waitForText(page, 'Notice given on')
    await page.goto(`${ctx.webUrl}/candidate/jobs/${forklift.id}`, { waitUntil: 'networkidle0' })
    await page.waitForSelector('[data-apply]')
    ctx.check(!(await page.$('[data-lock-banner]')), 'after notice the overlapping job is open')

    // 9. A re-hire offer after a placement that is over: read its rules, accept it.
    await db('agencyplacements', 'insertOne', {
      doc: {
        companyId: { $oid: companyA.id },
        candidateId: { $oid: candidate.id },
        jobId: { $oid: warehouse.id },
        status: 'confirmed',
        startDate: dayFromToday(-40),
        endDate: dayFromToday(-10),
        hoursPerWeek: 40,
        rules: { exclusivity: { value: 'no_other_agency_work' }, noticeDays: { value: null }, coolingOffDays: { value: null }, maxWeeklyHours: { value: null } },
        sources: { exclusivity: 'default' },
        confirmedAt: now,
        createdAt: now,
        updatedAt: now,
      },
    })
    const [over] = await db('agencyplacements', 'find', { filter: { candidateId: { $oid: candidate.id }, endDate: dayFromToday(-10) } })
    const offer = await api(`/agency/placements/${over._id.$oid ?? over._id}/rehire`, { method: 'POST', token: agencyA.token, body: { jobId: nightPicker.id } })
    ctx.check(offer.status === 201, `re-hire offered (${offer.status})`)
    await page.goto(`${ctx.webUrl}/candidate/agencies?tab=offers`, { waitUntil: 'networkidle0' })
    await page.click('[data-placement="Night Picker"] [data-view-offer]')
    await waitForText(page, 'Rules if you accept')
    await ctx.screenshot(page, '9-offer')
    await page.click('[data-accept-offer]')
    await waitForText(page, 'You accepted the placement as Night Picker.')
    await page.goto(`${ctx.webUrl}/candidate/agencies`, { waitUntil: 'networkidle0' })
    await page.waitForSelector('[data-placement="Night Picker"]')
    ctx.check(true, 'the accepted offer is an upcoming placement')
    await handle.checkOverflow()
    await ctx.screenshot(page, '10-placements')
    if (!phone) {
      await page.evaluate(() => localStorage.setItem('lwm-pref-theme', 'dark'))
      await page.reload({ waitUntil: 'networkidle0' })
      await page.waitForSelector('[data-placement="Night Picker"]')
      await ctx.screenshot(page, '10b-placements-dark')
      await page.evaluate(() => localStorage.setItem('lwm-pref-theme', 'light'))
    }

    // 10. The emails: each change came as an "agency update".
    const summaries = (await mailTo(candidate.email, 'agency_update')).map((mail) => mail.params.summary)
    ctx.check(
      ['accepted your request', 'Your placement as Warehouse Operative', 'offered you a new placement as Night Picker'].every((part) => summaries.some((summary) => summary.includes(part))),
      `emails: ${summaries.length} agency updates`,
    )
  },
}
