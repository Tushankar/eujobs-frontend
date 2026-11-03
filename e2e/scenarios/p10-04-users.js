import { invitedAdmin, openAsAdmin, roleWith } from '../lib/admins.js'
import { clickText, responseTo, waitForPath, waitForText } from '../lib/flows.js'
import { ownerToken } from '../lib/recruiters.js'
import { api, date, db } from '../lib/testApi.js'

const country = (code) => new Intl.DisplayNames(['en'], { type: 'region' }).of(code)
const VERIFICATION = { not_started: 'Not started', in_review: 'In review', verified: 'Verified' }
const verificationLabel = ({ state, count }) => VERIFICATION[state] ?? `${count} of 3 verified`
const FILLERS = 21

const rowTexts = (page) => page.$$eval('main table tbody tr', (rows) => rows.map((row) => row.innerText.replace(/\s+/g, ' ')))
const headers = (page) => page.$$eval('main table thead th', (cells) => cells.map((cell) => cell.innerText.trim()))

/**
 * P10-04 (M-161, M-169, M-206, M-138, OQ-6d): the Candidates table shows Country, Right to work, Verification,
 * Completeness % and Plan as the server computes them, with filters, server pagination and the country filter. The CSV
 * export has a BOM and headers in the admin's language, and is audited. "Manage" opens the detail page with every
 * section. Recruiters show Pending, Approved, Rejected or Suspended.
 */
export default {
  name: 'P10-04 Users',
  viewports: ['D', 'M'],
  async run(ctx) {
    const token = await ownerToken()
    // Enough candidates for a second page (20 a page), removed again at the end.
    const tag = `p10filler${ctx.viewport.toLowerCase()}`
    for (let n = 0; n < FILLERS; n += 1) {
      await db('users', 'insertOne', {
        doc: { role: 'candidate', status: 'unverified', email: `${tag}${n}@inbox.localworkman.eu`, fullName: `Filler ${n}`, language: 'en', createdAt: date('2026-01-01'), updatedAt: date('2026-01-01') },
      })
    }
    try {
      const handle = await ctx.newPage()
      const { page } = handle
      await openAsAdmin(ctx, handle, ctx.seedCredentials.email(null), '/admin/candidates', ctx.seedCredentials.password)
      await page.waitForSelector('main table tbody tr')
      const columns = await headers(page)
      for (const name of ['Country', 'Right to work', 'Verification', 'Completeness', 'Plan']) ctx.check(columns.includes(name), `column ${name} (got ${columns.join(', ')})`)

      // Each seeded candidate's row reads as the server computed it.
      const { body: all } = await api('/admin/users?role=candidate&pageSize=100', { token })
      const rows = await rowTexts(page)
      for (const person of all.items.filter((item) => !item.email.startsWith(tag)).slice(0, 20)) {
        const row = rows.find((text) => text.includes(person.email))
        if (!row) continue
        const expected = [person.country ? country(person.country) : '—', verificationLabel(person.verification), `${person.completeness}%`, person.plan === 'plus' ? 'Plus' : 'Free']
        ctx.check(expected.every((part) => row.includes(part)), `${person.fullName}: ${expected.join(' · ')} (row: ${row})`)
      }
      const emma = rows.find((text) => text.includes('Emma Wilson'))
      ctx.check(emma?.includes('Plus') && emma.includes('Verified') && emma.includes('United Kingdom'), `Emma: Plus, Verified, United Kingdom (${emma})`)
      await handle.checkOverflow()
      await ctx.screenshot(page, '1-candidates')

      // Server pagination: 20 a page.
      ctx.check(all.total > 20, `more than one page (${all.total})`)
      await waitForText(page, `1–20 of ${all.total}`)
      const next = responseTo(page, ['/api/v1/admin/users?', 'page=2'])
      await clickText(page, 'Next', 'main nav button')
      await next
      await waitForText(page, `21–${Math.min(40, all.total)} of ${all.total}`)
      ctx.check((await rowTexts(page)).length === Math.min(20, all.total - 20), 'page 2 rows')
      await ctx.screenshot(page, '2-page-2')

      // Filters: country, verification and plan, each matching the server's answer.
      const filterBy = async (name, value, query) => {
        const answered = responseTo(page, ['/api/v1/admin/users?', `${name}=${value}`])
        await page.select(`select[name="${name}"]`, value)
        await answered
        const expected = (await api(`/admin/users?role=candidate&${query}`, { token })).body
        await page.waitForFunction((count) => document.querySelectorAll('main table tbody tr').length === count, {}, expected.items.length)
        const shown = await rowTexts(page)
        ctx.check(expected.items.every((item) => shown.some((text) => text.includes(item.email))), `${query}: the server's rows are listed`)
        return expected
      }
      const germany = await filterBy('country', 'DE', 'country=DE')
      ctx.check(germany.items.length > 0 && (await rowTexts(page)).every((text) => text.includes('Germany')), 'every row is in Germany')
      await handle.checkOverflow()
      await ctx.screenshot(page, '3-germany')
      await page.select('select[name="country"]', '')
      await filterBy('verification', 'verified', 'verification=verified')
      await filterBy('plan', 'plus', 'verification=verified&plan=plus')
      await ctx.screenshot(page, '4-verified-plus')

      // The export: a BOM, English headers for this admin, and an audit event.
      const exported = responseTo(page, '/api/v1/admin/users/export')
      await clickText(page, 'Export CSV', 'button')
      const csv = await (await exported).text()
      ctx.check(csv.charCodeAt(0) === 0xfeff, 'the CSV starts with a BOM')
      ctx.check(csv.slice(1).startsWith('Name,Email,Joined,Status,Country,Right to work,Verification,Completeness %,Plan'), `English headers (${csv.slice(1, 90)})`)
      const audited = await db('auditevents', 'find', { filter: { type: 'reports.candidates_exported' } })
      ctx.check(audited.length > 0, 'the export is audited')
      // Headers follow the admin's language: a French-speaking admin who may export.
      const exporter = await invitedAdmin('Exporter', (await roleWith('Exporter', ['users.view', 'reports.export'])).id)
      await api('/me', { method: 'PATCH', token: exporter.token, body: { language: 'fr', languageExplicit: true } })
      const french = await fetch(`${new URL(page.url()).origin}/api/v1/admin/users/export?role=candidate`, { headers: { Authorization: `Bearer ${exporter.token}` } })
      const frenchText = await french.text()
      ctx.check(frenchText.slice(1).startsWith('Nom,E-mail,Inscription,Statut,Pays'), `French headers for a French admin (${frenchText.slice(1, 60)})`)

      // Manage → the detail page.
      await page.goto(`${ctx.webUrl}/admin/candidates?q=Emma`, { waitUntil: 'networkidle0' })
      await page.waitForSelector('main table a[aria-label="Manage Emma Wilson"]')
      await page.click('main table a[aria-label="Manage Emma Wilson"]')
      await waitForPath(page, '/admin/candidates/')
      await waitForText(page, 'Applications')
      const sections = await page.$$eval('main section h2', (titles) => titles.map((title) => title.innerText))
      for (const name of ['Account', 'Profile', 'Privacy', 'Verification', 'Right to work', 'Plan', 'Applications', 'Learning', 'History']) {
        ctx.check(sections.includes(name), `the detail page has ${name} (got ${sections.join(', ')})`)
      }
      ctx.check(await page.$('[data-submission]'), 'verification submissions are listed')
      await handle.checkOverflow()
      await ctx.screenshot(page, '5-candidate-detail')

      // Recruiters: Pending, Approved (and the other states), then a detail page.
      await page.goto(`${ctx.webUrl}/admin/recruiters`, { waitUntil: 'networkidle0' })
      await page.waitForSelector('main table tbody tr')
      const recruiters = await rowTexts(page)
      ctx.check(recruiters.find((text) => text.includes('James Chen'))?.includes('Pending'), 'James Chen is Pending')
      ctx.check(recruiters.find((text) => text.includes('Sarah Miller'))?.includes('Approved'), 'Sarah Miller is Approved')
      const states = (await api('/admin/users?role=recruiter&pageSize=100', { token })).body.items.map((item) => item.state)
      ctx.check(states.every((state) => ['pending', 'approved', 'rejected', 'suspended'].includes(state)), `recruiter states ${[...new Set(states)]}`)
      await handle.checkOverflow()
      await ctx.screenshot(page, '6-recruiters')
      await page.click('main table a[aria-label="Manage Sarah Miller"]')
      await waitForText(page, 'KYC documents')
      const recruiterSections = await page.$$eval('main section h2', (titles) => titles.map((title) => title.innerText))
      for (const name of ['Account', 'Company', 'KYC documents', 'Review history', 'Jobs', 'Learning', 'History']) {
        ctx.check(recruiterSections.includes(name), `the recruiter page has ${name} (got ${recruiterSections.join(', ')})`)
      }
      await handle.checkOverflow()
      await ctx.screenshot(page, '7-recruiter-detail')
      ctx.assertClean(handle.issues, 'users')
    } finally {
      await db('users', 'deleteMany', { filter: { email: { $regex: `^${tag}` } } })
    }
  },
}
