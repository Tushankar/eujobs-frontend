import { applyApi, completeCandidate, setTextarea } from '../lib/applicants.js'
import { clickText, waitForText } from '../lib/flows.js'
import { startApi } from '../lib/messages.js'
import { approvedRecruiter, jobBody, postJob } from '../lib/recruiters.js'
import { clickWithin, expectLock, signInRecruiter, trackRequests } from '../lib/recruiterPlan.js'

/**
 * P11c-01 (§3.22, P11c-Q3 … Q5, Q10, Q14 … Q16): a Free approved recruiter with one live job and one applicant.
 * Find candidates lists only the applicant; search, the job, filters, sort, Compare and Shortlist are locked; Shortlists
 * shows the gate; on the profile Shortlist, Message, Match insights and the CV request are locked; on Jobs the
 * "N relevant" link, the AI summary and Publish of a 2nd job are locked; the talent lists show the prompt. Each lock
 * opens the Recruiter Plus dialog and sends no request. A note saves and a reply in the candidate's thread sends.
 */
export default {
  name: 'P11c-01 Free recruiter locks',
  viewports: ['D', 'M'],
  async run(ctx) {
    const label = `FreeLocks${ctx.viewport}`
    const recruiter = await approvedRecruiter(label, { plus: false })
    const job = await postJob(recruiter.token, jobBody({ title: `${label} Designer` }))
    const draft = await postJob(recruiter.token, jobBody({ title: `${label} Second role` }), { draft: true })
    const candidate = await completeCandidate(`FreeApplicant${ctx.viewport}`)
    ctx.check((await applyApi(candidate.token, job.id)).status === 201, 'the candidate applies')

    const handle = await ctx.newPage()
    const { page } = handle
    const requests = trackRequests(page)
    await signInRecruiter(ctx, page, recruiter.email, '/recruiter/find-candidates')
    await page.waitForSelector(`article[data-candidate="${candidate.id}"]`)
    ctx.check((await page.$$('article[data-candidate]')).length === 1, 'Find candidates lists only the applicant')
    await waitForText(page, 'On Free you see the people who applied to your jobs.')
    await handle.checkOverflow()
    await ctx.screenshot(page, '1-find-candidates')

    const discovery = /\/recruiter\/(candidates\?|shortlist)/
    for (const text of ['Search candidates', 'Match candidates to a job', 'Filters', 'Recommended']) {
      await expectLock(ctx, page, requests, { label: text, click: () => clickWithin(page, 'main [data-plan-locked="discovery"]', text), forbidden: discovery })
    }
    await expectLock(ctx, page, requests, { label: 'Compare', click: () => clickWithin(page, `article[data-candidate="${candidate.id}"] [data-plan-locked]`, 'Compare'), forbidden: discovery })
    const dialog = await expectLock(ctx, page, requests, {
      label: 'card Shortlist',
      click: () => page.click(`article[data-candidate="${candidate.id}"] button[aria-pressed]`),
      forbidden: discovery,
    })
    ctx.check(dialog.includes('£49'), `the dialog shows the company country's price (${dialog.replace(/\n/g, ' ').slice(0, 160)})`)
    await page.click(`article[data-candidate="${candidate.id}"] button[aria-pressed]`)
    await page.waitForSelector('[role="dialog"] [data-checkout-summary]', { visible: true })
    await handle.checkOverflow()
    await ctx.screenshot(page, '2-upgrade-dialog')
    await page.keyboard.press('Escape')

    // Shortlists: the plan chip in the sidebar and the gate, with no shortlist request.
    if (ctx.viewport === 'D') ctx.check(await page.$('a[href="/recruiter/shortlists"] [data-plan-chip]'), 'Shortlists shows the plan chip')
    requests.mark()
    await page.goto(`${ctx.webUrl}/recruiter/shortlists`, { waitUntil: 'networkidle0' })
    await page.waitForSelector('[data-plan-gate="discovery"]')
    ctx.check(!requests.since().some((request) => request.includes('/recruiter/shortlist')), 'the gate sends no shortlist request')
    await ctx.screenshot(page, '3-shortlists-gate')

    // The applicant's profile: Shortlist, Message (no thread yet), Match insights, the CV request.
    await page.goto(`${ctx.webUrl}/recruiter/find-candidates/${candidate.id}`, { waitUntil: 'networkidle0' })
    await expectLock(ctx, page, requests, { label: 'profile Shortlist', click: () => clickWithin(page, 'aside [data-plan-locked="discovery"]', 'Add to shortlist'), forbidden: /\/recruiter\/shortlist/ })
    await expectLock(ctx, page, requests, { label: 'Message', click: () => page.click('[data-start-conversation]'), forbidden: /POST \/conversations/ })
    await expectLock(ctx, page, requests, { label: 'Match insights', click: () => clickWithin(page, 'aside [data-ai-locked]', 'AI match insights'), forbidden: /\/match\?/ })
    await handle.checkOverflow()
    await ctx.screenshot(page, '4-profile')
    await page.goto(`${ctx.webUrl}/recruiter/find-candidates/${candidate.id}/resume`, { waitUntil: 'networkidle0' })
    await expectLock(ctx, page, requests, { label: 'CV request', click: () => clickWithin(page, 'main [data-plan-locked="outreach"]', 'Send a CV request'), forbidden: /cv-requests/ })

    // Notes on an applicant stay on Free.
    await page.goto(`${ctx.webUrl}/recruiter/find-candidates/${candidate.id}/notes`, { waitUntil: 'networkidle0' })
    await setTextarea(page, 'textarea[name="note"]', 'Strong portfolio; invite to a first call.')
    await page.click('form button[type="submit"]')
    await page.waitForSelector('[data-note]')

    // Jobs: the relevant link, the AI summary and Publish of the draft while a job is live.
    await page.goto(`${ctx.webUrl}/recruiter/jobs`, { waitUntil: 'networkidle0' })
    const row = `tr:has(a[href="/recruiter/jobs/${job.id}"])`
    await expectLock(ctx, page, requests, { label: 'N relevant', click: () => clickWithin(page, `${row} [data-plan-locked="discovery"]`, 'relevant'), forbidden: discovery })
    await expectLock(ctx, page, requests, { label: 'AI job summary', click: () => clickWithin(page, `${row} [data-ai-locked]`, 'AI job summary'), forbidden: /ai-summary/ })
    await page.click(`button[aria-label="Manage ${draft.title}"]`)
    await expectLock(ctx, page, requests, { label: 'Publish a 2nd job', click: () => clickText(page, 'Publish job', 'button'), forbidden: /PATCH \/recruiter\/jobs\/.*\/status/ })
    await handle.checkOverflow()
    await ctx.screenshot(page, '5-jobs')

    // The talent lists: a prompt, and no request for them.
    requests.mark()
    await page.goto(`${ctx.webUrl}/recruiter/jobs/${job.id}`, { waitUntil: 'networkidle0' })
    ctx.check(!requests.since().some((request) => request.includes('relevant-talent')), 'no relevant-talent request')
    await expectLock(ctx, page, requests, { label: 'job See candidates', click: () => clickWithin(page, 'main [data-plan-locked="discovery"]', 'See candidates'), forbidden: /relevant-talent/ })
    requests.mark()
    await page.goto(`${ctx.webUrl}/recruiter`, { waitUntil: 'networkidle0' })
    ctx.check(!requests.since().some((request) => request.includes('/overview/talent')), 'no talent request on the Overview')
    await expectLock(ctx, page, requests, { label: 'Overview See candidates', click: () => clickWithin(page, 'main [data-plan-locked="discovery"]', 'See candidates'), forbidden: /overview\/talent/ })
    await handle.checkOverflow()
    await ctx.screenshot(page, '6-overview')

    // A conversation the candidate started: the Free recruiter replies (P11c-Q14).
    const { body: started } = await startApi(candidate.token, { jobId: job.id, body: 'Hello, thanks for considering my application.' })
    await page.goto(`${ctx.webUrl}/recruiter/messages/${started.conversation.id}`, { waitUntil: 'networkidle0' })
    await page.waitForSelector('textarea[name="body"]', { visible: true })
    await page.type('textarea[name="body"]', 'Thanks for applying. Are you free for a call this week?')
    const reply = page.waitForResponse((response) => response.url().includes(`/conversations/${started.conversation.id}/messages`) && response.request().method() === 'POST')
    await clickText(page, 'Send', 'footer button')
    ctx.check((await reply).status() === 201, 'the reply is sent')
    await waitForText(page, 'Are you free for a call this week?')
    await handle.checkOverflow()
    await ctx.screenshot(page, '7-reply')
    ctx.assertClean(handle.issues, 'free recruiter')
  },
}
