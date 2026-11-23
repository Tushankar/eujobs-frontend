import { approvedAgency, dayFromToday, publishAgreement } from '../lib/agencies.js'
import { completeCandidate } from '../lib/applicants.js'
import { bodyText, clickText, fill, signInWithForm, waitForPath, waitForText } from '../lib/flows.js'
import { openAs } from '../lib/payments.js'
import { jobBody, postJob } from '../lib/recruiters.js'
import { api, date, db, mailTo, TEST_PASSWORD } from '../lib/testApi.js'

/**
 * P15-03 (agencies, phase 6, owner 2026-11-23): AI for agencies. On an agency job, "Best from your books" ranks the
 * books by match (someone on a clashing placement only counted), AI reasons add a line each, and Offer placement sends
 * an offer; Talent › On the books ranks for a picked job; Placements shows "Fits next" under a placement that ends in
 * 7 days, and the daily run alerts the agency (bell + email); the job post writer fills the client, dates, rate and
 * hours from notes; For you leaves out agency jobs the candidate is blocked from. Desktop and phone.
 */
const ok = (result, what) => {
  if (result.status >= 300) throw new Error(`${what} failed: ${result.status} ${JSON.stringify(result.body?.error ?? {})}`)
  return result.body
}

/** The candidate joins the agency's books and agrees to version 1. */
async function onBooks(candidate, agency) {
  const joined = ok(await api(`/candidate/agencies/${agency.companyId}/join`, { method: 'POST', token: candidate.token }), 'join')
  ok(await api(`/agency/talent/${joined.id}/accept`, { method: 'POST', token: agency.token }), 'accept')
  ok(await api(`/candidate/agencies/memberships/${joined.id}/agree`, { method: 'POST', token: candidate.token, body: { version: 1 } }), 'agree')
}

/** A confirmed placement written directly: dates as day offsets. */
async function placement(candidate, agency, jobId, start, end) {
  const now = date(Date.now())
  await db('agencyplacements', 'insertOne', {
    doc: {
      companyId: { $oid: agency.companyId },
      candidateId: { $oid: candidate.id },
      jobId: { $oid: jobId },
      status: 'confirmed',
      startDate: dayFromToday(start),
      endDate: dayFromToday(end),
      hoursPerWeek: 40,
      rules: { exclusivity: { value: 'no_other_agency_work' }, noticeDays: { value: null }, coolingOffDays: { value: null }, maxWeeklyHours: { value: null } },
      sources: { exclusivity: 'default' },
      remindedStartOn: null,
      remindedEndOn: null,
      remindedAgencyEndOn: null,
      confirmedAt: now,
      createdAt: now,
      updatedAt: now,
    },
  })
}

export default {
  name: 'P15-03 AI for agencies',
  viewports: ['D', 'M'],
  async run(ctx) {
    // Setup: an agency (Agency Plus) with its agreement, a client and three published jobs.
    const agency = await approvedAgency('P1503')
    await publishAgreement(agency.token)
    agency.companyId = ok(await api('/me', { token: agency.token }), 'me').company.id
    const acme = ok(await api('/agency/clients', { method: 'POST', token: agency.token, body: { name: 'Acme Logistics' } }), 'client')
    const terms = (start, end) => ({ clientId: acme.id, showClient: true, startDate: dayFromToday(start), endDate: dayFromToday(end), rate: { amountMinor: 1450, period: 'hour' } })
    const warehouse = await postJob(agency.token, jobBody({ title: 'Warehouse Operative', agency: terms(3, 33) }))
    const current = await postJob(agency.token, jobBody({ title: 'Packing Cover', agency: terms(0, 7) }))
    const nightPicker = await postJob(agency.token, jobBody({ title: 'Night Picker', agency: terms(10, 20) }))

    // Four people on the books: Ada and Ben free, Cleo on a placement that clashes, Dev on one that ends in 7 days.
    const people = {}
    for (const label of ['Ada', 'Ben', 'Cleo', 'Dev']) {
      people[label] = await completeCandidate(`P1503${label}`, { plus: false })
      await onBooks(people[label], agency)
    }
    await placement(people.Cleo, agency, current.id, -3, 20)
    await placement(people.Dev, agency, current.id, -10, 7)

    const handle = await ctx.newPage()
    const { page } = handle
    await signInWithForm(page, ctx.webUrl, '/agencies/login', agency.email, TEST_PASSWORD)
    await waitForPath(page, '/agency')

    // 1. The job page: "Best from your books", Cleo only counted.
    await page.goto(`${ctx.webUrl}/agency/jobs/${warehouse.id}`, { waitUntil: 'networkidle0' })
    await page.waitForSelector('[data-books-ranking] [data-ranked]')
    const ranked = await page.$$eval('[data-books-ranking] [data-ranked]', (rows) => rows.map((row) => row.dataset.ranked))
    ctx.check(ranked.length === 2 && ![people.Cleo.fullName, people.Dev.fullName].some((name) => ranked.includes(name)), `ranked: the free people only (${ranked.join(', ')})`)
    ctx.check((await page.$eval('[data-ranking-hidden]', (note) => note.textContent)).includes('2 people on your books are on a placement during these dates'), 'the clashing placements are counted')
    ctx.check(Boolean(await page.$('[data-ranked] [data-match-badge]')), 'each person shows the match')
    await handle.checkOverflow()
    await ctx.screenshot(page, '1-books-ranking')

    // 2. AI reasons (Agency Plus, real OpenAI): one line per person.
    // Owner 2026-11-23 ("a glitch after generating"): the summary boxes are there while AI writes, and the list barely
    // moves when the text lands.
    const listHeight = () => page.$eval('[data-books-ranking] ul', (list) => list.getBoundingClientRect().height)
    await page.click('[data-ranking-reasons]')
    const writing = await page.waitForSelector('[data-ranked-writing]', { timeout: 5_000 }).catch(() => null)
    ctx.check(Boolean(writing), 'each person shows an "AI summary · Writing…" box while AI writes')
    const whileWriting = await listHeight()
    await ctx.screenshot(page, '2a-ai-writing')
    await page.waitForSelector('[data-ranked-reason]', { timeout: 60_000 })
    await new Promise((resolve) => setTimeout(resolve, 400))
    const jump = Math.abs((await listHeight()) - whileWriting)
    ctx.note(`list height while writing ${Math.round(whileWriting)}px, after ${Math.round(whileWriting + jump)}px`)
    ctx.check(jump <= 60, `the list barely moves when the summaries land (${Math.round(jump)}px)`)
    const disclaimerBelow = await page.$eval('[data-books-ranking]', (section) => {
      const note = section.querySelector('[data-ranking-disclaimer]')
      const list = section.querySelector('ul')
      return Boolean(note && list && note.getBoundingClientRect().top > list.getBoundingClientRect().bottom)
    })
    ctx.check(disclaimerBelow, 'the AI disclaimer sits under the list, not above it')
    const reasons = await page.$$eval('[data-ranked-reason] p', (lines) => lines.map((line) => line.textContent.trim()))
    ctx.check(reasons.length === 2 && reasons.every((line) => line.length > 10), `AI reasons for both (${reasons.length})`)
    await ctx.screenshot(page, '2-ai-reasons')

    // 3. Offer placement: the confirm dialog, then the person shows as Offered and the candidate hears about it.
    const first = ranked[0]
    await page.click(`[data-ranked="${first}"] [data-offer-placement]`)
    await waitForText(page, `Offer Warehouse Operative to ${first}?`)
    await ctx.screenshot(page, '3-offer-dialog')
    await clickText(page, 'Send offer', '[role="dialog"] button')
    await page.waitForFunction((name) => document.querySelector(`[data-ranked="${name}"]`)?.innerText.includes('Offered'), {}, first)
    const offeredTo = Object.values(people).find((person) => person.fullName === first)
    const offers = ok(await api('/candidate/placements?view=offered', { token: offeredTo.token }), 'offers').items
    ctx.check(offers.some((item) => item.job.title === 'Warehouse Operative'), 'the candidate has the offer')
    const other = ranked[1]
    ctx.check(Boolean(await page.$(`[data-ranked="${other}"] [data-start-conversation]`)), 'Message is offered for someone on the books')

    // 4. Talent › On the books: rank everyone for a picked job.
    await page.goto(`${ctx.webUrl}/agency/talent`, { waitUntil: 'networkidle0' })
    // 2026-11-23: the job picker is the app's own list (it was the browser's select).
    await page.waitForSelector('[data-rank-for]')
    await page.click('[data-rank-for]')
    await page.waitForSelector('[data-rank-option="Night Picker"]')
    await ctx.screenshot(page, '4a-job-picker-open')
    await page.click('[data-rank-option="Night Picker"]')
    await page.waitForSelector('[data-books-ranking] [data-ranked]')
    const forNight = await page.$$eval('[data-books-ranking] [data-ranked]', (rows) => rows.map((row) => row.dataset.ranked))
    // Night Picker starts on day 10: Dev (free from day 8) fits, Cleo (to day 20) does not.
    ctx.check(forNight.includes(people.Dev.fullName) && !forNight.includes(people.Cleo.fullName), `Talent ranking for Night Picker (${forNight.join(', ')})`)
    ctx.check(page.url().includes(`jobId=${nightPicker.id}`), 'the picked job is in the address')
    await handle.checkOverflow()
    await ctx.screenshot(page, '4-talent-rank-for')

    // 5. Placements › Running: Dev's placement ends in 7 days, "Fits next" lists Night Picker.
    await page.goto(`${ctx.webUrl}/agency/placements`, { waitUntil: 'networkidle0' })
    await page.waitForSelector(`[data-placement="${people.Dev.fullName}"] [data-fits-next]`)
    const next = await page.$$eval(`[data-placement="${people.Dev.fullName}"] [data-next-job]`, (rows) => rows.map((row) => row.dataset.nextJob))
    ctx.check(next.includes('Night Picker') && !next.includes('Warehouse Operative'), `Fits next (${next.join(', ')})`)
    ctx.check(!(await page.$(`[data-placement="${people.Cleo.fullName}"] [data-fits-next]`)), 'a placement ending later has no Fits next')
    await handle.checkOverflow()
    await ctx.screenshot(page, '5-fits-next')

    // 6. The daily run alerts the agency 7 days before the end: bell and email, once.
    await db('jobruns', 'updateMany', { filter: { name: 'placement-reminders' }, update: { $set: { lastRunAt: null } } })
    ok(await api('/_test/scheduler/tick', { method: 'POST', body: {} }), 'tick')
    await page.goto(`${ctx.webUrl}/agency/notifications`, { waitUntil: 'networkidle0' })
    await waitForText(page, `${people.Dev.fullName}'s placement as Packing Cover ends on`)
    ctx.check((await bodyText(page)).includes('of your jobs fit'), 'the bell says how many jobs fit next')
    const mails = (await mailTo(agency.email, 'agency_update')).map((mail) => mail.params.summary).filter((summary) => summary.includes('placement as Packing Cover'))
    ctx.check(mails.length === 1 && mails[0].includes('Night Picker'), `the email names the next jobs (${mails[0]})`)
    await ctx.screenshot(page, '6-ending-soon-bell')

    // 7. The job post writer reads the client, dates, rate and hours from the notes (real OpenAI).
    await page.goto(`${ctx.webUrl}/agency/jobs/new`, { waitUntil: 'networkidle0' })
    await fill(page, 'input[name="title"]', 'Forklift Driver')
    await fill(page, '[data-job-ai-draft] textarea', `Three weeks of night cover for Acme Logistics from ${dayFromToday(14)} to ${dayFromToday(35)}, 15.50 an hour, 38 hours a week, forklift licence needed.`)
    await page.click('[data-job-ai-draft-button]')
    // The filled line, or the AI's own failure message (limit, pause, busy, error), whichever comes first.
    await page.waitForSelector('[data-job-ai-filled], [data-job-ai-draft] [data-ai-state]:not([data-ai-state="loading"])', { timeout: 90_000 })
    const aiState = await page.$eval('[data-job-ai-draft]', (panel) => panel.querySelector('[data-ai-state]:not([data-ai-state="loading"])')?.innerText ?? null)
    if (aiState) throw new Error(`the job post writer failed: ${aiState}`)
    const filled = (await page.$eval('[data-job-ai-filled]', (line) => line.dataset.jobAiFilled)).split(',')
    ctx.check(['clientId', 'startDate', 'endDate', 'rateAmount', 'hoursPerWeek'].every((field) => filled.includes(field)), `the agency terms were filled (${filled.join(', ')})`)
    // 2026-11-23: the drafted text shows on this step too (it lives on the later steps; the owner saw "nothing").
    const preview = await page.$eval('[data-job-ai-preview]', (panel) => panel.innerText)
    ctx.check(preview.includes('In your posting now') && preview.includes('Responsibilities'), 'the draft is previewed under the button')
    await handle.checkOverflow()
    await ctx.screenshot(page, '7-ai-job-draft')

    // Owner 2026-11-23 ("I gave notes and Draft with AI did nothing"): a second draft over filled fields offers the
    // AI's version beside what is there, field by field; nothing changes until a click.
    await fill(page, '[data-job-ai-draft] textarea', `Night cover for Acme Logistics from ${dayFromToday(14)} to ${dayFromToday(35)}, 16 an hour, 30 hours a week.`)
    await page.click('[data-job-ai-draft-button]')
    await page.waitForSelector('[data-job-ai-compare], [data-job-ai-filled]', { timeout: 90_000 })
    await new Promise((resolve) => setTimeout(resolve, 500))
    const offered = await page.$$eval('[data-ai-compare]', (rows) => rows.map((row) => row.dataset.aiCompare))
    ctx.check(offered.includes('rateAmount') && offered.includes('hoursPerWeek'), `the second draft offers the new pay rate and hours to compare (${offered.join(', ')})`)
    await ctx.screenshot(page, '7a-ai-compare')
    if (offered.includes('rateAmount')) {
      await page.click('[data-ai-use="rateAmount"]')
      await new Promise((resolve) => setTimeout(resolve, 300))
      const stillOffered = await page.$$eval('[data-ai-compare]', (rows) => rows.map((row) => row.dataset.aiCompare))
      ctx.check(!stillOffered.includes('rateAmount'), 'Use AI’s version takes the pay rate and leaves the rest to choose')
    }

    // Owner 2026-11-23: "show in which fields, with stars, what AI analysed". Each field the draft filled carries a
    // "✦ AI" pill after its label, on its own step.
    const heading = () => page.$eval('form h2', (title) => title.textContent.trim()).catch(() => '')
    const marked = () => page.$$eval('.ai-filled', (fields) => fields.map((field) => (field.querySelector(':scope > label, :scope > legend')?.textContent ?? field.textContent).trim()))
    await clickText(page, 'Continue', 'button')
    await page.waitForFunction(() => document.querySelector('form h2')?.textContent.trim() === 'Responsibilities', { timeout: 15_000 }).catch(() => {})
    const onResponsibilities = await marked()
    ctx.check(onResponsibilities.length >= 2, `the description and responsibilities carry the AI mark (${onResponsibilities.join(', ')})`)
    const pill = await page.$eval('.ai-filled > label', (label) => getComputedStyle(label, '::after').content).catch(() => '')
    ctx.check(pill.includes('AI'), `the mark reads "✦ AI" (${pill})`)
    await ctx.screenshot(page, '7b-ai-marks-responsibilities')
    for (let tries = 0; tries < 6 && (await heading()) !== 'Agency terms'; tries += 1) {
      await clickText(page, 'Continue', 'button')
      await new Promise((resolve) => setTimeout(resolve, 1200))
    }
    if ((await heading()) === 'Agency terms') {
      const onTerms = await marked()
      ctx.note(`AI-marked agency terms: ${onTerms.join(' | ')}`)
      ctx.check(['Client', 'Start date', 'End date', 'Hours per week'].every((name) => onTerms.some((label) => label.startsWith(name))) && onTerms.some((label) => label.startsWith('Pay rate')), 'client, dates, pay rate and hours carry the AI mark')
      await ctx.screenshot(page, '7c-ai-marks-agency-terms')
    } else ctx.note(`could not reach Agency terms to check its marks (stopped on "${await heading()}")`)

    // 8. For you: Cleo is blocked from both agency jobs until day 21, so neither is suggested to her.
    // By id: other scenarios in the same run post jobs with the same titles (P15-02 has its own Night Picker).
    const forYou = ok(await api('/jobs/recommended', { token: people.Cleo.token }), 'for you').items.map((job) => job.id)
    ctx.check(!forYou.includes(warehouse.id) && !forYou.includes(nightPicker.id), 'For you leaves out blocked agency jobs')
    const adaForYou = ok(await api('/jobs/recommended', { token: people.Ada.token }), 'for you').items.map((job) => job.id)
    ctx.check(adaForYou.includes(nightPicker.id), 'a free candidate still gets the agency jobs')
    // The agency signs out first (the sign-in page sends a signed-in user to their workspace).
    await page.evaluate(() => localStorage.clear())
    await openAs(ctx, handle, people.Cleo.email, '/candidate?tab=for-you')
    await page.waitForSelector('main')
    await new Promise((resolve) => setTimeout(resolve, 800))
    ctx.check(!(await page.$(`a[href*="${nightPicker.id}"]`)), 'Overview For you in the browser')
    await ctx.screenshot(page, '8-for-you-blocked')
  },
}
