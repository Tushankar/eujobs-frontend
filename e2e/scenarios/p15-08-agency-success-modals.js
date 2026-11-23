import { approvedAgency, dayFromToday } from '../lib/agencies.js'
import { completeCandidate } from '../lib/applicants.js'
import { uploadAs } from '../lib/candidates.js'
import { fixture } from '../fixtures/make.js'
import { clickText, signInWithForm } from '../lib/flows.js'
import { jobBody, postJob } from '../lib/recruiters.js'
import { api, date, db, TEST_PASSWORD } from '../lib/testApi.js'

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const NONE = { value: null, clause: null }
const RULES = { exclusivity: { value: 'no_other_agency_work', clause: null }, noticeDays: { value: 7, clause: 'Either party may end an Assignment by giving seven days of written notice.' }, coolingOffDays: NONE, maxWeeklyHours: NONE }

/**
 * P15-08 (owner 2026-11-23: "when I invite and all, show a proper modal: invite sent and all"): the success modal after
 * each agency action, on both sides, with the modals switched on. Agency: agreement published, a join request accepted,
 * an invite sent, a placement offer sent, agreement version 2 published. Candidate: asked to join, agreed (on the
 * books), placement offer accepted. Each modal must name the right person, job or agency and close cleanly.
 */
export default {
  name: 'P15-08 Agency success modals',
  viewports: ['D', 'M'],
  async run(ctx) {
    const issue = (text) => ctx.note(`ISSUE: ${text}`)
    const expect = (ok, text) => (ok ? ctx.note(`ok: ${text}`) : issue(text))

    // The modal of `kind`: its text is noted and checked for `includes`, then it is closed.
    async function modal(page, kind, includes, shot) {
      const found = await page.waitForSelector(`[data-success-kind="${kind}"]`, { timeout: 10_000 }).catch(() => null)
      if (!found) {
        await ctx.screenshot(page, `missing-${kind}`)
        const seen = await page.evaluate(() => ({
          off: localStorage.getItem('eujobs.e2e.celebrations'),
          dialogs: [...document.querySelectorAll('[role="dialog"]')].map((box) => box.innerText.slice(0, 160)),
          alerts: [...document.querySelectorAll('[role="alert"]')].map((box) => box.innerText),
        }))
        return issue(`no "${kind}" success modal: ${JSON.stringify(seen)} | page issues: ${pages.flatMap((one) => one.issues).join(' | ')}`)
      }
      await pause(900) // the burst and the drawn check
      const text = await page.$eval(`[data-success-kind="${kind}"]`, (box) => box.innerText.replace(/\s+/g, ' ').trim())
      ctx.note(`${kind}: ${text.slice(0, 220)}`)
      for (const part of includes) expect(text.includes(part), `the ${kind} modal says "${part}"`)
      await ctx.screenshot(page, shot)
      await page.click('[data-success-close]')
      await page.waitForSelector(`[data-success-kind="${kind}"]`, { hidden: true, timeout: 5_000 }).catch(() => issue(`the ${kind} modal does not close`))
    }

    // Moments waiting from before (approved, profile complete) open on the first page after sign-in; a user reads and
    // closes them first, so does this. Returns their texts.
    async function closeWaiting(page) {
      const texts = []
      for (let round = 0; round < 4; round += 1) {
        const box = await page.waitForSelector('[data-success-kind]', { timeout: 3_000 }).catch(() => null)
        if (!box) break
        await pause(700)
        texts.push(await box.evaluate((element) => `${element.dataset.successKind}: ${element.innerText.replace(/\s+/g, ' ').slice(0, 160)}`))
        await page.click('[data-success-close]')
        await pause(500)
      }
      return texts
    }

    const agency = await approvedAgency('P1508')
    const company = (await api('/me', { token: agency.token })).body.company
    const acme = (await api('/agency/clients', { method: 'POST', token: agency.token, body: { name: 'Acme Ports' } })).body
    const first = await completeCandidate('P1508A', { plus: false })
    const second = await completeCandidate('P1508B', { plus: false })

    const pages = []
    const handle = await ctx.newPage(null, { celebrations: true })
    pages.push(handle)
    const { page } = handle
    await signInWithForm(page, ctx.webUrl, '/agencies/login', agency.email, TEST_PASSWORD)
    await ctx.screenshot(page, '00-agency-welcome')
    const welcome = await closeWaiting(page)
    ctx.note(`agency moments after sign-in: ${welcome.join(' | ') || 'none'}`)
    const approved = welcome.find((text) => text.startsWith('account_approved'))
    if (approved) expect(approved.includes('Your agency is approved') && !approved.includes('Your company is approved'), 'an approved agency reads "Your agency is approved", not the company text')

    // ---- Agency: publish the agreement (the draft and its rules are ready) ----
    await uploadAs(agency.token, '/agency/agreement', fixture('agency-agreement.pdf'), 'application/pdf')
    await api('/agency/agreement/draft/rules', { method: 'PUT', token: agency.token, body: RULES })
    await page.goto(`${ctx.webUrl}/agency/talent?tab=agreement`, { waitUntil: 'networkidle0' })
    await page.waitForSelector('[data-rules-action="publish"]', { timeout: 10_000 })
    await page.click('[data-rules-action="publish"]')
    await modal(page, 'agreement_published', ['Your agreement is live', 'Version 1'], '01-agency-agreement-published')

    const terms = (start, end) => ({ clientId: acme.id, showClient: true, startDate: dayFromToday(start), endDate: dayFromToday(end), rate: { amountMinor: 1500, period: 'hour' } })
    const picker = await postJob(agency.token, jobBody({ title: 'Warehouse Picker', agency: terms(10, 30) }))
    const lead = await postJob(agency.token, jobBody({ title: 'Night Shift Lead', agency: terms(40, 60) }))

    // ---- Candidate: ask to join from the job page ----
    const seeker = await ctx.newPage(null, { celebrations: true })
    pages.push(seeker)
    await signInWithForm(seeker.page, ctx.webUrl, '/sign-in', first.email, TEST_PASSWORD)
    ctx.note(`candidate moments after sign-in: ${(await closeWaiting(seeker.page)).join(' | ') || 'none'}`)
    await seeker.page.goto(`${ctx.webUrl}/candidate/jobs/${picker.id}`, { waitUntil: 'networkidle0' })
    await seeker.page.waitForSelector('[data-join-agency]', { timeout: 10_000 }).catch(() => issue('no Join button on the agency job'))
    await seeker.page.click('[data-join-agency]')
    await modal(seeker.page, 'books_join_requested', ['Request sent', company.displayName], '02-candidate-join-requested')

    // ---- Agency: accept the request ----
    await page.goto(`${ctx.webUrl}/agency/talent?tab=requests`, { waitUntil: 'networkidle0' })
    await clickText(page, 'Accept', `[data-member="${first.fullName}"] button`)
    await modal(page, 'books_request_accepted', ['Request accepted', first.fullName], '03-agency-request-accepted')

    // Owner 2026-11-23 (production crash "reading 'id'" on /agency): after the books are loaded, the Overview's talent
    // cards (Agency Plus) must not read the books as candidates. Client-side navigation keeps the cache, as a user would.
    // The sidebar link (hidden in the menu on a phone), clicked through the DOM: an in-app navigation either way.
    const linked = await page.evaluate(() => {
      const link = [...document.querySelectorAll('a[href="/agency"]')].find((element) => element.textContent.includes('Overview'))
      link?.click()
      return Boolean(link)
    })
    if (!linked) issue('no Overview link in the agency navigation')
    await page.waitForFunction(() => location.pathname === '/agency', { timeout: 10_000 }).catch(() => {})
    await pause(1500)
    const crashed = (await page.$eval('body', (body) => body.innerText).catch(() => '')).includes('Unexpected Application Error')
    expect(!crashed, 'the agency Overview opens after the Talent page (no crash)')
    await ctx.screenshot(page, '03b-agency-overview')

    // ---- Candidate: agree to the agreement ----
    await seeker.page.goto(`${ctx.webUrl}/candidate/agencies?tab=agencies`, { waitUntil: 'networkidle0' })
    await clickText(seeker.page, 'Read agreement', 'a')
    await seeker.page.waitForSelector('[data-agree]', { timeout: 10_000 })
    await seeker.page.$eval('input[name="agree"]', (box) => box.click())
    await seeker.page.click('[data-agree]')
    await modal(seeker.page, 'agreement_agreed', ['on the books', 'version 1', company.displayName], '04-candidate-agreed')

    // ---- Agency: invite someone else from their profile ----
    await page.goto(`${ctx.webUrl}/agency/find-candidates/${second.id}`, { waitUntil: 'networkidle0' })
    await page.waitForSelector('[data-invite-books]', { timeout: 10_000 }).catch(() => issue('no "Invite to your books" on the profile'))
    await page.click('[data-invite-books]')
    await modal(page, 'books_invite_sent', ['Invite sent', second.fullName], '05-agency-invite-sent')
    expect((await page.$eval('[data-books-state]', (box) => box.dataset.booksState).catch(() => null)) === 'awaiting_agreement', 'the profile then shows them as invited')

    // ---- Agency: offer the first candidate a placement (re-hire after one that is over) ----
    const now = date(Date.now())
    await db('agencyplacements', 'insertOne', {
      doc: {
        companyId: { $oid: company.id }, candidateId: { $oid: first.id }, jobId: { $oid: picker.id }, status: 'confirmed',
        startDate: dayFromToday(-40), endDate: dayFromToday(-10), hoursPerWeek: 40,
        rules: { exclusivity: { value: 'no_other_agency_work' }, noticeDays: { value: 7 }, coolingOffDays: { value: null }, maxWeeklyHours: { value: null } },
        sources: { exclusivity: 'agreement' }, confirmedAt: now, createdAt: now, updatedAt: now,
      },
    })
    await page.goto(`${ctx.webUrl}/agency/placements?tab=over`, { waitUntil: 'networkidle0' })
    await clickText(page, 'Re-hire', `[data-placement="${first.fullName}"] button`)
    await page.waitForSelector('[role="dialog"] select')
    await page.select('[role="dialog"] select', lead.id).catch(() => issue('Night Shift Lead is not offered for the re-hire'))
    await clickText(page, 'Send offer', '[role="dialog"] button')
    await modal(page, 'placement_offer_sent', ['Offer sent', first.fullName, 'Night Shift Lead'], '06-agency-offer-sent')

    // ---- Candidate: accept the offer ----
    await seeker.page.goto(`${ctx.webUrl}/candidate/agencies?tab=offers`, { waitUntil: 'networkidle0' })
    await seeker.page.waitForSelector('[data-view-offer]', { timeout: 10_000 }).catch(() => issue('the candidate has no offer to view'))
    await seeker.page.click('[data-view-offer]')
    await seeker.page.waitForSelector('[data-accept-offer]')
    await seeker.page.click('[data-accept-offer]')
    await modal(seeker.page, 'placement_accepted', ['Placement confirmed', 'Night Shift Lead', company.displayName], '07-candidate-placement-accepted')

    // ---- Agency: version 2 of the agreement ----
    await uploadAs(agency.token, '/agency/agreement', fixture('agency-agreement.pdf'), 'application/pdf')
    await api('/agency/agreement/draft/rules', { method: 'PUT', token: agency.token, body: RULES })
    await page.goto(`${ctx.webUrl}/agency/talent?tab=agreement`, { waitUntil: 'networkidle0' })
    await page.waitForSelector('[data-rules-action="publish"]', { timeout: 10_000 })
    await page.click('[data-rules-action="publish"]')
    await modal(page, 'agreement_version_published', ['Version 2 is live', '(1)'], '08-agency-version-2')

    await handle.checkOverflow()
    await seeker.checkOverflow()
    ctx.note(`page issues: ${[...handle.issues, ...seeker.issues].join(' | ') || 'none'}`)
  },
}
