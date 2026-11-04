import { openAsAdmin } from '../lib/admins.js'
import { clickText, responseTo, waitForPath, waitForText } from '../lib/flows.js'
import { approvedRecruiter, jobBody, ownerToken, postJob } from '../lib/recruiters.js'
import { api, db } from '../lib/testApi.js'

const rowTexts = (page) => page.$$eval('main table tbody tr', (rows) => rows.map((row) => row.innerText.replace(/\s+/g, ' ')))

/**
 * P10-11 (M-046, M-164, P10-Q4, P10-Q15): admin Jobs lists every status with the status filter (All, Published, Paused,
 * Draft, Closed) and the country filter; a draft row offers no AI summary and no "Open case". "Open case" on a job row
 * opens a case in Moderation; back on Jobs the row offers "View case".
 */
export default {
  name: 'P10-11 Jobs admin',
  viewports: ['D'],
  async run(ctx) {
    const label = `AdminJobs${Date.now() % 100000}`
    const recruiter = await approvedRecruiter(label)
    const titles = { published: `${label} Published`, paused: `${label} Paused`, closed: `${label} Closed`, draft: `${label} Draft` }
    const published = await postJob(recruiter.token, jobBody({ title: titles.published }))
    const paused = await postJob(recruiter.token, jobBody({ title: titles.paused }))
    await api(`/recruiter/jobs/${paused.id}/status`, { method: 'PATCH', token: recruiter.token, body: { status: 'paused' } })
    const closed = await postJob(recruiter.token, jobBody({ title: titles.closed }))
    await api(`/recruiter/jobs/${closed.id}/status`, { method: 'PATCH', token: recruiter.token, body: { status: 'closed' } })
    const draft = await postJob(recruiter.token, jobBody({ title: titles.draft }), { draft: true })

    const handle = await ctx.newPage()
    const { page } = handle
    await openAsAdmin(ctx, handle, ctx.seedCredentials.email(null), `/admin/jobs?q=${label}`, ctx.seedCredentials.password)
    await page.waitForFunction((count) => document.querySelectorAll('main table tbody tr').length === count, {}, 4)
    let rows = await rowTexts(page)
    for (const [status, title] of Object.entries(titles)) {
      const row = rows.find((text) => text.includes(title))
      ctx.check(row?.includes(status[0].toUpperCase() + status.slice(1)), `All: ${title} shows ${status} (${row})`)
    }
    ctx.check(!(await page.$(`[data-admin-job="${draft.id}"]`)), 'the draft row has no AI summary or Open case (P10-Q4)')
    ctx.check(await page.$(`[data-admin-job="${published.id}"] [data-open-case]`), 'a published row offers Open case')
    const options = await page.$$eval('select[name="status"] option', (items) => items.map((item) => item.textContent))
    ctx.check(JSON.stringify(options) === JSON.stringify(['All statuses', 'Published', 'Paused', 'Draft', 'Closed']), `status options (${options})`)
    await ctx.screenshot(page, '1-all-statuses')

    for (const [status, title] of Object.entries(titles)) {
      const listed = responseTo(page, ['/api/v1/admin/jobs?', `status=${status}`])
      await page.select('select[name="status"]', status)
      await listed
      await page.waitForFunction((wanted) => [...document.querySelectorAll('main table tbody tr')].every((row) => row.innerText.includes(wanted)), {}, title)
      rows = await rowTexts(page)
      ctx.check(rows.length === 1 && rows[0].includes(title), `${status}: only ${title} (${rows.join(' | ')})`)
    }
    // The country filter applies on the server (job.country).
    const token = await ownerToken()
    const germany = (await api('/admin/jobs?country=DE&pageSize=100', { token })).body
    ctx.check(germany.items.every((job) => job.country === 'DE'), 'country=DE lists only German jobs')
    await ctx.screenshot(page, '2-closed-filter')

    // Open case from the published row.
    await page.select('select[name="status"]', '')
    await page.waitForSelector(`[data-admin-job="${published.id}"] [data-open-case]`)
    await page.click(`[data-admin-job="${published.id}"] [data-open-case]`)
    await page.waitForSelector('#open-case-form')
    await page.select('#open-case-form select[name="reason"]', 'misleading')
    await page.type('#open-case-form textarea[name="details"]', 'The salary does not match the level.')
    await ctx.screenshot(page, '3-open-case')
    const opened = responseTo(page, [`/api/v1/admin/jobs/${published.id}/case`], 'POST')
    await clickText(page, 'Open case', '[role="dialog"] button[type="submit"]')
    const caseId = (await (await opened).json()).id
    await waitForPath(page, `/admin/moderation/content/${caseId}`)
    await waitForText(page, 'Opened by an admin from Jobs')
    const [stored] = await db('moderationcases', 'find', { filter: { _id: { $oid: caseId } } })
    ctx.check(stored?.openedBy === 'admin' && stored.status === 'open' && stored.reports[0].reason === 'misleading', 'the case is stored, opened by the admin')
    await ctx.screenshot(page, '4-case-in-moderation')

    await page.goto(`${ctx.webUrl}/admin/jobs?q=${label}`, { waitUntil: 'networkidle0' })
    await page.waitForSelector(`[data-admin-job="${published.id}"] a[href="/admin/moderation/content/${caseId}"]`)
    ctx.check(!(await page.$(`[data-admin-job="${published.id}"] [data-open-case]`)), 'the row now offers View case instead')
    await ctx.screenshot(page, '5-view-case')
    ctx.assertClean(handle.issues, 'jobs admin')
  },
}
