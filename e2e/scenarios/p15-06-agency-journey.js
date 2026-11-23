import { submittedAgency, dayFromToday } from '../lib/agencies.js'
import { chooseStage, clickApply, completeCandidate } from '../lib/applicants.js'
import { fixture } from '../fixtures/make.js'
import { bodyText, chooseFile, clickText, fill, signInWithForm, waitForText } from '../lib/flows.js'
import { decide, jobBody, postJob } from '../lib/recruiters.js'
import { api, date, db, TEST_PASSWORD } from '../lib/testApi.js'
import { approvedAgency } from '../lib/agencies.js'

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * P15-06 (owner 2026-11-23: "check every agency flow as a user, both sides, and any inconsistency"): one journey through
 * the real screens. A new Free agency signs in for the first time, adds a client, publishes its agreement by hand and
 * posts an agency job through every wizard step; a candidate finds it, reads "Before you apply", applies and asks to join
 * the books; the agency accepts and tries Hired before the agreement is agreed; the candidate agrees; the agency hires
 * from Applications; both see the placement; another agency's overlapping job is blocked; the Free plan's one live job.
 * Problems are written as notes (ISSUE: …) so the whole journey runs; it fails only where the next step cannot happen.
 */
export default {
  name: 'P15-06 Agency journey',
  viewports: ['D', 'M'],
  async run(ctx) {
    const issue = (text) => ctx.note(`ISSUE: ${text}`)
    const expect = (ok, text) => (ok ? ctx.note(`ok: ${text}`) : issue(text))
    const continueStep = (page) => clickText(page, 'Continue', 'button[type="submit"]')
    const heading = (page) => page.$eval('form h2', (title) => title.textContent)
    async function next(page, title) {
      await continueStep(page)
      await page.waitForFunction((text) => document.querySelector('form h2')?.textContent === text, { timeout: 15_000 }, title).catch(async () => {
        issue(`Continue did not reach "${title}" (still on "${await heading(page)}"): ${(await bodyText(page)).match(/[^\n]*(required|invalid|Enter|Choose|Add)[^\n]*/i)?.[0] ?? ''}`)
        throw new Error(`stuck before ${title}`)
      })
    }

    // ---- 1. A new Free agency, first sign-in (tour not done yet) ----
    const agency = await submittedAgency('P1506')
    const me = (await api('/me', { token: agency.token })).body
    await decide(me.id, 'approved')
    const handle = await ctx.newPage()
    const { page } = handle
    handle.allow(409, '/api/v1/recruiter/applications')
    handle.allow(422, '/api/v1/recruiter/applications')
    await signInWithForm(page, ctx.webUrl, '/agencies/login', agency.email, TEST_PASSWORD)
    await pause(800)
    const tour = await page.$('[role="dialog"]')
    expect(Boolean(tour), 'first sign-in opens the welcome tour')
    await ctx.screenshot(page, '01-first-sign-in')
    if (tour) await clickText(page, 'Skip for now', '[role="dialog"] button').catch(() => issue('no "Skip for now" on the welcome tour'))
    await page.waitForSelector('[data-agency-setup]', { timeout: 10_000 }).catch(() => issue('the Overview has no setup checklist'))
    expect((await page.$eval('[data-agency-setup]', (card) => card.dataset.agencySetup).catch(() => null)) === 'client', 'the setup starts with a client')
    await ctx.screenshot(page, '02-overview-setup')

    // ---- 2. A client, through the dialog ----
    await clickText(page, 'Start', '[data-setup-step="client"] a')
    await page.waitForSelector('[data-add-client]')
    await page.click('[data-add-client]')
    await page.waitForSelector('#client-form')
    await fill(page, '#client-form input[name="name"]', 'Harbour Logistics')
    await fill(page, '#client-form input[name="industry"]', 'Logistics')
    await page.click('button[form="client-form"]')
    await page.waitForSelector('[data-client="Harbour Logistics"]')
    await ctx.screenshot(page, '03-client-added')

    // ---- 3. The agreement by hand (Free: no AI reading) ----
    await page.goto(`${ctx.webUrl}/agency`, { waitUntil: 'networkidle0' })
    expect((await page.$eval('[data-agency-setup]', (card) => card.dataset.agencySetup).catch(() => null)) === 'agreement', 'after the client the setup asks for the agreement')
    await clickText(page, 'Start', '[data-setup-step="agreement"] a')
    await page.waitForSelector('input[type="file"]')
    await chooseFile(page, 'input[type="file"]', fixture('agency-agreement.pdf'))
    await page.waitForSelector('[data-agreement-draft]')
    const aiLocked = await page.$eval('[data-read-agreement]', (button) => button.textContent).catch(() => '')
    ctx.note(`Free agency sees the AI read button as: "${aiLocked.trim()}"`)
    await ctx.screenshot(page, '04-agreement-draft')
    await page.select('select[name="exclusivity.value"]', 'no_other_agency_work').catch(() => issue('exclusivity select not found'))
    await fill(page, 'input[name="noticeDays.value"]', '7')
    await page.waitForSelector('textarea[name="noticeDays.clause"]')
    await fill(page, 'textarea[name="noticeDays.clause"]', 'Either party may end an Assignment by giving seven days of written notice.')
    // Exclusivity with no clause: is that allowed, and does it say so?
    await page.click('[data-rules-action="publish"]')
    await page.waitForSelector('[data-agreement-current]', { timeout: 10_000 }).catch(async () => issue(`publishing the agreement failed: ${(await bodyText(page)).slice(0, 300)}`))
    await ctx.screenshot(page, '05-agreement-published')

    // ---- 4. The agency job, through every wizard step ----
    await page.goto(`${ctx.webUrl}/agency`, { waitUntil: 'networkidle0' })
    expect((await page.$eval('[data-agency-setup]', (card) => card.dataset.agencySetup).catch(() => null)) === 'job', 'after the agreement the setup asks for a job')
    await clickText(page, 'Start', '[data-setup-step="job"] a')
    await page.waitForSelector('input[name="title"]')
    const employment = await page.$$eval('select[name="employmentType"] option', (options) => options.map((option) => option.textContent))
    ctx.note(`agency employment types: ${employment.join(', ')}`)
    await fill(page, 'input[name="title"]', 'Warehouse Operative')
    await ctx.screenshot(page, '06-wizard-basics')
    await continueStep(page)
    // The first Continue saves the draft and reopens the wizard on /jobs/:id/edit.
    await page.waitForFunction(() => /\/agency\/jobs\/[a-f0-9]{24}\/edit/.test(location.pathname), { timeout: 15_000 })
    await page.waitForSelector('textarea[name="brief"]', { visible: true })
    await pause(300)
    await fill(page, 'textarea[name="brief"]', 'Pick, pack and load orders on day shifts at a busy port warehouse, with a friendly team and full training.')
    await fill(page, 'textarea[name="responsibilities"]', 'Pick and pack orders\nLoad lorries safely\nKeep the floor tidy')
    await next(page, 'Required skills')
    for (const skill of ['Order picking', 'Forklift']) {
      await fill(page, 'input[placeholder="Type a skill and press Enter"]', skill)
      await page.keyboard.press('Enter')
    }
    await next(page, 'Preferred skills')
    await next(page, 'Experience & languages')
    await page.select('select[name="level"]', 'junior')
    await fill(page, 'input[name="experienceYears"]', '1')
    await next(page, 'Location & work')
    await page.select('select[name="workPreference"]', 'on_site')
    await page.type('input[name="jobCity"]', 'London')
    await page.waitForSelector('[role="option"]')
    await clickText(page, 'London', '[role="option"]')
    await pause(500)
    const locationText = await bodyText(page)
    expect(!/Minimum salary|Maximum salary/.test(locationText), 'the agency location step does not ask for a salary (agency jobs use a pay rate)')
    await ctx.screenshot(page, '07-wizard-location')
    await next(page, 'Agency terms')
    await page.click('[data-client-picker]')
    await page.waitForSelector('[data-client-option="Harbour Logistics"]')
    await page.click('[data-client-option="Harbour Logistics"]')
    await page.click('[data-date-picker="startDate"]')
    await page.waitForSelector('[role="grid"] [data-day]')
    for (let index = 0; index < 5; index += 1) await page.keyboard.press('ArrowRight')
    await page.keyboard.press('Enter')
    await page.click('[data-length="month"]')
    await fill(page, 'input[name="rateAmount"]', '14.50')
    await pause(300)
    await ctx.screenshot(page, '08-wizard-terms')
    await next(page, 'Quality checks')
    await page.waitForSelector('li[data-check]', { timeout: 10_000 }).catch(() => issue('the quality checks never appear'))
    const checks = await page.$$eval('li[data-check]', (items) => items.map((item) => `${item.dataset.check}:${item.dataset.ok}`))
    ctx.note(`quality checks: ${checks.join(', ')}`)
    expect(!checks.some((check) => check.startsWith('salary')), 'the quality checks do not ask an agency job for a salary')
    await ctx.screenshot(page, '09-wizard-quality')
    await next(page, 'Review')
    const review = await bodyText(page)
    expect(review.includes('£14.50') || review.includes('14.50'), 'the review shows the pay rate')
    expect(!/Not shown|Salary/i.test(review.split('Review')[1] ?? ''), 'the review does not show an empty "Salary" for an agency job')
    await ctx.screenshot(page, '10-wizard-review')
    await next(page, 'Publish')
    await ctx.screenshot(page, '11-wizard-publish')
    await clickText(page, 'Publish job', 'button')
    await page.waitForFunction(() => /\/agency\/jobs\/[a-f0-9]{24}$/.test(location.pathname), { timeout: 15_000 }).catch(async () => issue(`publishing the job did not open its page: ${(await bodyText(page)).slice(0, 300)}`))
    const jobId = page.url().split('/').pop()
    await ctx.screenshot(page, '12-job-published')

    // ---- 5. A candidate finds it, reads "Before you apply", applies and asks to join ----
    const candidate = await completeCandidate('P1506C', { plus: false })
    const now = date(Date.now())
    await db('subscriptions', 'insertOne', { doc: { userId: { $oid: candidate.id }, planKey: 'plus', status: 'active', retrying: false, currency: 'GBP', amountMinor: 999, cancelAtPeriodEnd: false, source: 'stripe', startedAt: now, createdAt: now, updatedAt: now } })
    const seeker = await ctx.newPage()
    await signInWithForm(seeker.page, ctx.webUrl, '/sign-in', candidate.email, TEST_PASSWORD)
    await seeker.page.goto(`${ctx.webUrl}/candidate/jobs`, { waitUntil: 'networkidle0' })
    await pause(500)
    // The list is ranked by match; a search for the title finds the new agency job.
    await fill(seeker.page, 'form[role="search"] input', 'Warehouse Operative')
    await seeker.page.keyboard.press('Enter')
    await pause(1500)
    const findJobs = await bodyText(seeker.page)
    expect(findJobs.includes('Warehouse Operative'), 'Find jobs finds the new agency job')
    await ctx.screenshot(seeker.page, '13-candidate-find-jobs')
    await seeker.page.goto(`${ctx.webUrl}/candidate/jobs/${jobId}`, { waitUntil: 'networkidle0' })
    await seeker.page.waitForSelector('[data-placement-rules]', { timeout: 10_000 }).catch(() => issue('no "Before you apply" on the agency job'))
    const before = await seeker.page.$eval('[data-placement-rules]', (section) => section.innerText).catch(() => '')
    ctx.note(`Before you apply: ${before.replace(/\s+/g, ' ').slice(0, 400)}`)
    await seeker.page.$eval('[data-placement-rules]', (section) => section.scrollIntoView({ block: 'start' })).catch(() => {})
    await pause(900) // the job page fades sections in as they scroll into view
    await ctx.screenshot(seeker.page, '14-candidate-before-apply')
    await clickApply(seeker.page)
    await seeker.page.waitForSelector('[data-apply-dialog]')
    await seeker.page.$eval('[data-apply-dialog] input[name="joinAgency"]', (box) => box.click()).catch(() => issue('no "Also ask to join" in the apply dialog'))
    await seeker.page.$eval('[data-apply-dialog] input[name="consent"]', (box) => box.click())
    await ctx.screenshot(seeker.page, '15-candidate-apply')
    await seeker.page.click('button[form="apply-form"]')
    await seeker.page.waitForSelector('[data-membership="requested"]', { timeout: 10_000 }).catch(() => issue('after applying the job page does not show the join request'))
    await ctx.screenshot(seeker.page, '16-candidate-applied')

    // ---- 6. The agency: the application, the request, Hired too early ----
    await page.goto(`${ctx.webUrl}/agency/applications`, { waitUntil: 'networkidle0' })
    await pause(500)
    const applications = await bodyText(page)
    expect(applications.includes(candidate.fullName), 'the agency sees the application')
    const chip = await page.$eval('[data-books]', (element) => element.dataset.books).catch(() => null)
    expect(chip === 'requested', `the application row shows the join request (books: ${chip})`)
    await ctx.screenshot(page, '17-agency-applications')
    const [appDoc] = await db('applications', 'find', { filter: { candidateId: { $oid: candidate.id }, jobId: { $oid: jobId } } })
    const application = appDoc && { id: String(appDoc._id.$oid ?? appDoc._id) }
    if (application) {
      const select = `[data-stage-select="${application.id}"] select`
      await chooseStage(page, select, 'Hired').catch((error) => issue(`no Hired option: ${error.message}`))
      await pause(1500)
      const tooEarly = await bodyText(page)
      expect(tooEarly.includes('not on your books yet'), 'Hired too early says the candidate is not on the books yet')
      await ctx.screenshot(page, '18-agency-hired-too-early')
      // Accept the join request right from the row.
      await page.click('[data-books-accept]').catch(() => issue('no Accept on the application row'))
      await page.waitForFunction(() => document.querySelector('[data-books]')?.dataset.books === 'awaiting_agreement', { timeout: 10_000 }).catch(() => issue('accepting from the row did not update it'))
      await ctx.screenshot(page, '18b-agency-accepted-from-row')
    } else issue('could not find the application through the API')

    await page.goto(`${ctx.webUrl}/agency/talent?tab=requests`, { waitUntil: 'networkidle0' })
    await page.waitForSelector(`[data-member="${candidate.fullName}"]`, { timeout: 10_000 }).catch(() => issue('the join request is not in Talent › Requests'))
    // Already accepted from the application row: Talent says it waits for the agreement.
    await waitForText(page, 'Waiting for them to agree').catch(() => issue('Talent does not show the accepted request as waiting for the agreement'))
    await ctx.screenshot(page, '19-agency-requests')

    // ---- 7. The candidate agrees ----
    await seeker.page.goto(`${ctx.webUrl}/candidate/agencies?tab=agencies`, { waitUntil: 'networkidle0' })
    await pause(500)
    await ctx.screenshot(seeker.page, '20-candidate-my-agencies')
    await clickText(seeker.page, 'Read agreement', 'a').catch(() => issue('no "Read agreement" link for the candidate'))
    await seeker.page.waitForSelector('[data-agree]', { timeout: 10_000 })
    await seeker.page.$eval('input[name="agree"]', (box) => box.click())
    // Owner 2026-11-23 (screenshot): the rules beside the PDF were squeezed to a word per line. Each value needs room.
    const narrowest = await seeker.page.$$eval('[data-rules] dd', (cells) => Math.min(...cells.map((cell) => cell.getBoundingClientRect().width)))
    expect(narrowest >= 240, `the agreement rules have room for their values (narrowest ${Math.round(narrowest)}px)`)
    if (ctx.viewport === 'D') {
      const pinned = await seeker.page.$eval('[data-agreement-page] form', (side) => getComputedStyle(side).position)
      expect(pinned === 'sticky', `the rules column stays in view while the page scrolls (${pinned})`)
    }
    await ctx.screenshot(seeker.page, '21-candidate-agreement')
    await seeker.page.click('[data-agree]')
    await waitForText(seeker.page, 'books').catch(() => issue('agreeing gives no confirmation'))

    // ---- 8. The agency hires from Applications ----
    await page.goto(`${ctx.webUrl}/agency/applications`, { waitUntil: 'networkidle0' })
    if (application) {
      const select = `[data-stage-select="${application.id}"] select`
      await chooseStage(page, select, 'Hired')
      await pause(1500)
      await ctx.screenshot(page, '22-agency-hired')
    }
    await page.goto(`${ctx.webUrl}/agency/placements?tab=upcoming`, { waitUntil: 'networkidle0' })
    await page.waitForSelector(`[data-placement="${candidate.fullName}"]`, { timeout: 10_000 }).catch(() => issue('no placement after Hired'))
    await ctx.screenshot(page, '23-agency-placement')
    await page.goto(`${ctx.webUrl}/agency`, { waitUntil: 'networkidle0' })
    await pause(500)
    ctx.note(`setup after the placement: ${await page.$eval('[data-agency-setup]', (card) => card.dataset.agencySetup).catch(() => 'hidden (all done)')}`)
    await ctx.screenshot(page, '24-agency-overview-after')

    // ---- 9. The candidate: the placement, and another agency's overlapping job ----
    await seeker.page.goto(`${ctx.webUrl}/candidate/agencies`, { waitUntil: 'networkidle0' })
    await pause(500)
    expect((await bodyText(seeker.page)).includes('Warehouse Operative'), 'the candidate sees the placement')
    await ctx.screenshot(seeker.page, '25-candidate-placement')
    const other = await approvedAgency('P1506B')
    const otherClient = (await api('/agency/clients', { method: 'POST', token: other.token, body: { name: 'Northwind' } })).body
    const overlapping = await postJob(other.token, jobBody({ title: 'Night Picker', agency: { clientId: otherClient.id, showClient: true, startDate: dayFromToday(10), endDate: dayFromToday(20), rate: { amountMinor: 1500, period: 'hour' } } }))
    await seeker.page.goto(`${ctx.webUrl}/candidate/jobs/${overlapping.id}`, { waitUntil: 'networkidle0' })
    await pause(800)
    expect(Boolean(await seeker.page.$('[data-lock-banner]')), 'the overlapping job of another agency is blocked with a reason')
    expect((await seeker.page.$eval('[data-eligibility]', (box) => box.dataset.eligibility).catch(() => null)) === 'blocked', '"Before you apply" says blocked too')
    await ctx.screenshot(seeker.page, '26-candidate-blocked')
    await seeker.page.goto(`${ctx.webUrl}/candidate/notifications`, { waitUntil: 'networkidle0' })
    await pause(500)
    await ctx.screenshot(seeker.page, '27-candidate-bell')
    await page.goto(`${ctx.webUrl}/agency/notifications`, { waitUntil: 'networkidle0' })
    await pause(500)
    await ctx.screenshot(page, '28-agency-bell')

    // ---- 10. Free: a second live job ----
    await page.goto(`${ctx.webUrl}/agency/jobs`, { waitUntil: 'networkidle0' })
    await pause(500)
    await ctx.screenshot(page, '29-agency-jobs')
    const second = await postJob(agency.token, jobBody({ title: 'Second role', agency: { clientId: (await api('/agency/clients', { token: agency.token })).body.items[0].id, startDate: dayFromToday(40), endDate: dayFromToday(60), rate: { amountMinor: 1500, period: 'hour' } } }), { draft: true })
    await page.goto(`${ctx.webUrl}/agency/jobs/${second.id}/edit?step=9`, { waitUntil: 'networkidle0' })
    await pause(800)
    await ctx.screenshot(page, '30-free-second-job')
    // Agency Free keeps 1 live job: publishing a second one must offer Agency Plus (not Recruiter Plus).
    handle.allow(402, '/api/v1/recruiter/jobs')
    await clickText(page, 'Publish job', 'button')
    await page.waitForSelector('[role="dialog"]', { timeout: 10_000 }).catch(() => {})
    await pause(500)
    const limit = await bodyText(page)
    expect(limit.includes('Agency Plus'), 'publishing a second job on Agency Free offers Agency Plus')
    expect(!limit.includes('Recruiter Plus'), 'the limit does not mention Recruiter Plus')
    ctx.note(`second job publish: ${limit.replace(/\s+/g, ' ').slice(0, 300)}`)
    await ctx.screenshot(page, '31-free-limit')
    ctx.note(`page issues: ${[...handle.issues, ...seeker.issues].join(' | ') || 'none'}`)
  },
}
