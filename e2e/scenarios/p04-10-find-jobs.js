import { onboardedCandidate } from '../lib/candidates.js'
import { clickText, fill, signInWithForm, waitForText } from '../lib/flows.js'
import { approvedRecruiter, decide, jobBody, login, postJob } from '../lib/recruiters.js'
import { api, db, TEST_PASSWORD } from '../lib/testApi.js'

/**
 * P4-10 (M-043, M-044, M-137, OD2, U25, P4-Q4, §3.6): in the Germany view only German on-site and hybrid jobs of
 * approved, unrestricted companies list; the yearly salary filter counts a monthly job ×12; keywords follow the
 * rules; a saved job stays saved; a paused job reads "No longer accepting applications" for its saver and "no longer
 * available" for others; en + Germany formats money as en-DE; the Remote view is in EUR.
 */
export default {
  name: 'P4-10 Find jobs',
  viewports: ['D', 'M'],
  async run(ctx) {
    const a = await approvedRecruiter('FindA', { city: 'berlin' })
    const aToken = await login(a.email)
    const berlin = await postJob(aToken, jobBody({ title: 'Berlin monthly designer', city: 'berlin', salary: { min: 5000, max: 6000, period: 'month' } }))
    const munich = await postJob(aToken, jobBody({ title: 'Munich onsite lead', city: 'munich', workPreference: 'on_site', level: 'lead', salary: { min: 65000, max: 70000, period: 'year' } }))
    const paused = await postJob(aToken, jobBody({ title: 'Paused saved role', city: 'berlin', salary: null }))
    const restricted = await postJob(aToken, jobBody({ title: 'Restricted role', city: 'berlin' }))
    await db('jobs', 'updateMany', { filter: { _id: { $oid: restricted.id } }, update: { $set: { restricted: { reason: 'Test', at: { $date: new Date().toISOString() } } } } })
    const b = await approvedRecruiter('FindB', { city: 'berlin' })
    const hidden = await postJob(await login(b.email), jobBody({ title: 'Suspended company role', city: 'berlin' }))
    await decide(b.userId, 'suspended', 'Test suspension')

    const candidate = await onboardedCandidate('Finder')
    await api('/me', { method: 'PATCH', token: candidate.token, body: { pickerCountry: 'DE' } })
    const handle = await ctx.newPage()
    const { page } = handle
    await signInWithForm(page, ctx.webUrl, '/sign-in', candidate.email, TEST_PASSWORD)
    await page.goto(`${ctx.webUrl}/candidate/jobs`, { waitUntil: 'networkidle0' })
    await waitForText(page, 'Jobs in Germany')
    // The test database is shared by both viewports, so check this run's jobs by id and every listed job by the API.
    const listed = await page.$$eval('article[data-job]', (cards) => cards.map((card) => card.dataset.job))
    ctx.check([berlin.id, munich.id, paused.id].every((id) => listed.includes(id)), `this run's German jobs are listed (got ${listed})`)
    ctx.check(![restricted.id, hidden.id].some((id) => listed.includes(id)), 'restricted and suspended jobs are not listed')
    const items = (await api('/jobs', { token: candidate.token })).body.items
    ctx.check(items.every((job) => job.country === 'DE' && job.workPreference !== 'remote'), 'every listed job is a German on-site or hybrid job')

    // en + Germany: money in en-DE (M-133).
    const expected = `${new Intl.NumberFormat('en-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).formatRange(5000, 6000)} per month`
    const berlinText = await page.$eval(`article[data-job="${berlin.id}"]`, (card) => card.innerText)
    ctx.check(berlinText.includes(expected), `en-DE salary "${expected}" (card: ${berlinText.replace(/\n/g, ' | ')})`)
    await handle.checkOverflow()
    await ctx.screenshot(page, '1-germany')

    // U25, P4-Q4: 6,000 a month is 72,000 a year; the yearly 70,000 job and the job without salary are left out.
    await clickText(page, 'Filters', 'button')
    await fill(page, 'input[name="salaryMin"]', '71000')
    await page.waitForNetworkIdle()
    await clickText(page, 'Show', '[role="dialog"] button')
    await page.waitForFunction(
      (keep, drop) => document.querySelector(`article[data-job="${keep}"]`) && !drop.some((id) => document.querySelector(`article[data-job="${id}"]`)),
      {},
      berlin.id,
      [munich.id, paused.id],
    )
    await ctx.screenshot(page, '2-salary-filter')
    await clickText(page, 'Filters', 'button')
    await clickText(page, 'Clear all', '[role="dialog"] button')
    await clickText(page, 'Show', '[role="dialog"] button')

    await fill(page, 'input[aria-label="Search jobs"]', 'munich lead')
    await page.waitForFunction(
      (keep, drop) => document.querySelector(`article[data-job="${keep}"]`) && !document.querySelector(`article[data-job="${drop}"]`),
      {},
      munich.id,
      berlin.id,
    )
    await fill(page, 'input[aria-label="Search jobs"]', 'munich junior')
    await page.waitForFunction((id) => !document.querySelector(`article[data-job="${id}"]`), {}, munich.id)
    // Clear by keyboard: setting the DOM value directly does not reach React's state.
    await page.click('input[aria-label="Search jobs"]', { count: 3 })
    await page.keyboard.press('Backspace')
    await page.waitForSelector(`article[data-job="${berlin.id}"]`)

    await page.click(`article[data-job="${berlin.id}"] button[aria-pressed]`)
    await page.waitForSelector(`article[data-job="${berlin.id}"] button[aria-pressed="true"]`)
    await page.reload({ waitUntil: 'networkidle0' })
    await page.waitForSelector(`article[data-job="${berlin.id}"] button[aria-pressed="true"]`)

    await api(`/candidate/saved-jobs/${paused.id}`, { method: 'PUT', token: candidate.token })
    await api(`/recruiter/jobs/${paused.id}/status`, { method: 'PATCH', token: aToken, body: { status: 'paused' } })
    await page.goto(`${ctx.webUrl}/candidate/jobs/${paused.id}`, { waitUntil: 'networkidle0' })
    await waitForText(page, 'No longer accepting applications')
    await waitForText(page, 'Paused saved role')
    await handle.checkOverflow()
    await ctx.screenshot(page, '3-paused-for-saver')
    ctx.assertClean(handle.issues, 'find jobs')

    const other = await ctx.newPage()
    other.allow(404, `/api/v1/jobs/${paused.id}`)
    await signInWithForm(other.page, ctx.webUrl, '/sign-in', ctx.seedCredentials.email('emma'), ctx.seedCredentials.password)
    await other.page.goto(`${ctx.webUrl}/candidate/jobs/${paused.id}`, { waitUntil: 'networkidle0' })
    await waitForText(other.page, 'This job is no longer available')
    await ctx.screenshot(other.page, '4-paused-for-others')
    ctx.assertClean(other.issues, 'paused for others')

    await api('/me', { method: 'PATCH', token: candidate.token, body: { pickerCountry: 'REMOTE' } })
    ctx.check((await api('/jobs', { token: candidate.token })).body.view.currency === 'EUR', 'the Remote view is in EUR')
  },
}
