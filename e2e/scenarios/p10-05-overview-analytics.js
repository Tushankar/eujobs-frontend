import { createRequire } from 'node:module'
import { join } from 'node:path'
import { openAsAdmin } from '../lib/admins.js'
import { responseTo } from '../lib/flows.js'
import { SERVER_DIR } from '../lib/env.js'
import { db } from '../lib/testApi.js'

const { DateTime } = createRequire(join(SERVER_DIR, 'package.json'))('luxon')
const ZONE = 'Europe/Madrid'
const PERIODS = ['this_week', 'last_week', 'last_month']
const oid = (row) => row._id.$oid ?? row._id
const idOf = (value) => value?.$oid ?? value
const when = (value) => new Date(value?.$date ?? value)

/** The period's buckets in ZONE (Monday weeks; last month = its ISO weeks clipped to the month), as the server defines them. */
function buckets(period, now = DateTime.now().setZone(ZONE)) {
  if (period === 'last_month') {
    const start = now.startOf('month').minus({ months: 1 })
    const end = start.plus({ months: 1 })
    const list = []
    for (let cursor = start; cursor < end; ) {
      const next = DateTime.min(cursor.startOf('week').plus({ weeks: 1 }), end)
      list.push([cursor, next])
      cursor = next
    }
    return list
  }
  const start = now.startOf('week').minus({ weeks: period === 'last_week' ? 1 : 0 })
  return Array.from({ length: 7 }, (_, day) => [start.plus({ days: day }), start.plus({ days: day + 1 })])
}

const countIn = (dates, [from, to]) => dates.filter((date) => date >= from.toJSDate() && date < to.toJSDate()).length

/** Independent numbers from the test database (no app code), for all countries or one. */
async function expected(country) {
  const [users, profiles, companies, jobs, applications, enrollments, certificates, results, shortlist, conversations] = await Promise.all(
    ['users', 'candidateprofiles', 'companies', 'jobs', 'applications', 'enrollments', 'certificates', 'matchresults', 'shortlistentries', 'conversations'].map((name) =>
      db(name, 'find', { filter: {} }),
    ),
  )
  const profileCountry = new Map(profiles.map((profile) => [idOf(profile.userId), profile.location?.countryCode]))
  const companyCountry = new Map(companies.map((company) => [idOf(company.ownerUserId), company.location?.countryCode]))
  const countryOf = (user) => (user.role === 'candidate' ? profileCountry.get(oid(user)) : companyCountry.get(oid(user)))
  const people = users.filter((user) => ['candidate', 'recruiter'].includes(user.role) && (!country || countryOf(user) === country))
  const scopedJobs = jobs.filter((job) => !country || job.country === country)
  const jobIds = new Set(scopedJobs.map(oid))
  const published = scopedJobs.filter((job) => job.status === 'published')
  const live = applications.filter((application) => application.status !== 'withdrawn' && jobIds.has(idOf(application.jobId)))
  const means = published
    .map((job) => results.filter((result) => idOf(result.jobId) === oid(job)).map((result) => result.score).sort((a, b) => b - a).slice(0, 5))
    .filter((scores) => scores.length)
    .map((scores) => scores.reduce((sum, score) => sum + score, 0) / scores.length)
  const userIds = new Set(people.map(oid))
  const companyIds = new Set(companies.filter((company) => !country || company.location?.countryCode === country).map(oid))
  const listed = new Set(shortlist.map((entry) => `${idOf(entry.companyId)}:${idOf(entry.candidateId)}`))
  return {
    kpis: {
      candidateRegistrations: people.filter((user) => user.role === 'candidate').length,
      activeUsers: people.filter((user) => user.status === 'active').length,
      publishedJobs: published.length,
      applications: live.length,
      courseEnrollments: enrollments.filter((row) => !country || userIds.has(idOf(row.userId))).length,
      courseBadges: certificates.filter((row) => row.status === 'valid' && (!country || userIds.has(idOf(row.userId)))).length,
      averageRoleMatch: means.length ? `${Math.round(means.reduce((sum, mean) => sum + mean, 0) / means.length)}%` : '—',
    },
    roles: published.length,
    analytics: {
      shortlistConversion: live.length ? `${Math.round((live.filter((application) => listed.has(`${idOf(application.companyId)}:${idOf(application.candidateId)}`)).length / live.length) * 100)}%` : '—',
      recruiterAccounts: people.filter((user) => user.role === 'recruiter').length,
      companyRegistrations: companyIds.size,
      reviewedOutreach: conversations.filter((item) => item.startedBy === 'recruiter' && companyIds.has(idOf(item.companyId))).length,
    },
    series: Object.fromEntries(
      PERIODS.map((period) => [
        period,
        buckets(period).map((bucket) => [
          countIn(people.map((user) => when(user.createdAt)), bucket),
          countIn(applications.filter((application) => jobIds.has(idOf(application.jobId))).map((application) => when(application.appliedAt)), bucket),
        ]),
      ]),
    ),
  }
}

const kpiText = (page, key) => page.$eval(`[data-kpi="${key}"] section > p span`, (element) => element.textContent.trim())
const waitForKpi = (page, key, text) =>
  page.waitForFunction((k, wanted) => document.querySelector(`[data-kpi="${k}"] section > p span`)?.textContent.trim() === wanted, { timeout: 15_000 }, key, text)

/** The numbers a chart shows, from its accessible description ("Mon: 2 registrations, 1 applications; …"). */
async function chartPairs(page) {
  const label = await page.$eval('[data-activity-chart] [aria-label], [data-activity-chart][aria-label]', (element) => element.getAttribute('aria-label'))
  return [...label.matchAll(/(\d+) registrations, (\d+) applications/g)].map((match) => [Number(match[1]), Number(match[2])])
}

/**
 * P10-05 (§3.15, OQ-5, M-170 … M-177, M-138): every Overview KPI equals an independent count from /_test/db; "Average role
 * match" says "Across {n} published roles"; the other KPIs say "All time"; the chart shows the real counts for this week,
 * last week and last month in the browser time zone; the country filter changes the numbers; Analytics likewise.
 */
export default {
  name: 'P10-05 Overview and Analytics',
  viewports: ['D', 'M'],
  async run(ctx) {
    const handle = await ctx.newPage()
    const { page } = handle
    await page.emulateTimezone(ZONE)
    await openAsAdmin(ctx, handle, ctx.seedCredentials.email(null), '/admin', ctx.seedCredentials.password)

    for (const country of ['', 'GB']) {
      const want = await expected(country)
      if (country) {
        const loaded = responseTo(page, ['/api/v1/admin/overview?', `country=${country}`])
        await page.select('select[name="country"]', country)
        await loaded
      }
      for (const [key, value] of Object.entries(want.kpis)) {
        const text = typeof value === 'number' ? new Intl.NumberFormat('en-IE').format(value) : value
        await waitForKpi(page, key, text).catch(async () => ctx.check(false, `${country || 'all'} ${key}: ${await kpiText(page, key)} ≠ ${text}`))
      }
      const verified = await page.evaluate(async (query) => {
        const response = await fetch(`/api/v1/admin/users?role=candidate&verification=verified${query}`, { headers: { Authorization: `Bearer ${localStorage.getItem('lwm-auth-token')}` } })
        return (await response.json()).total
      }, country ? `&country=${country}` : '')
      await waitForKpi(page, 'verifiedProfiles', String(verified))
      const captions = await page.$$eval('[data-kpi] section', (cards) => cards.map((card) => card.innerText))
      ctx.check(captions.filter((text) => text.includes('All time')).length === 7, 'seven KPIs say "All time"')
      ctx.check(captions.some((text) => text.includes(`Across ${want.roles} published role`)), `Average role match: "Across ${want.roles} published roles"`)

      for (const period of PERIODS) {
        if (period !== 'this_week') {
          const loaded = responseTo(page, ['/api/v1/admin/activity?', `period=${period}`])
          await page.select('select[name="period"]', period)
          await loaded
        }
        await page.waitForSelector(`[data-activity-chart="${period}"]`)
        const shown = await chartPairs(page)
        ctx.check(JSON.stringify(shown) === JSON.stringify(want.series[period]), `${country || 'all'} ${period}: chart ${JSON.stringify(shown)} = ${JSON.stringify(want.series[period])}`)
      }
      await page.select('select[name="period"]', 'this_week')
      await handle.checkOverflow()
      await ctx.screenshot(page, `1-overview-${country || 'all'}`)
    }
    const all = await expected('')
    const gb = await expected('GB')
    ctx.check(JSON.stringify(all.kpis) !== JSON.stringify(gb.kpis), 'the country filter changes the numbers')

    // The line view shows the same counts (M-171).
    await page.click('button[aria-label="Line view"]')
    await page.waitForSelector('[data-activity-chart] svg')
    await ctx.screenshot(page, '2-overview-line')

    // Analytics: the four cards and the chart, then a country.
    for (const country of ['', 'DE']) {
      const want = await expected(country)
      await page.goto(`${ctx.webUrl}/admin/analytics${country ? `?country=${country}` : ''}`, { waitUntil: 'networkidle0' })
      for (const [key, value] of Object.entries(want.analytics)) {
        const text = typeof value === 'number' ? String(value) : value
        await waitForKpi(page, key, text).catch(async () => ctx.check(false, `analytics ${country || 'all'} ${key}: ${await kpiText(page, key)} ≠ ${text}`))
      }
      await page.waitForSelector('[data-activity-chart="this_week"]')
      const shown = await chartPairs(page)
      ctx.check(JSON.stringify(shown) === JSON.stringify(want.series.this_week), `analytics ${country || 'all'} this week: ${JSON.stringify(shown)}`)
      await handle.checkOverflow()
      await ctx.screenshot(page, `3-analytics-${country || 'all'}`)
    }
    await page.goto(`${ctx.webUrl}/admin/analytics?view=line&period=last_month`, { waitUntil: 'networkidle0' })
    await page.waitForSelector('[data-activity-chart="last_month"] svg')
    ctx.check(JSON.stringify(await chartPairs(page)) === JSON.stringify(all.series.last_month), 'analytics last month, line view')
    await ctx.screenshot(page, '4-analytics-line-month')
    ctx.assertClean(handle.issues, 'overview and analytics')
  },
}
