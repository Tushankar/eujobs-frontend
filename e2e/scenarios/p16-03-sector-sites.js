import { openAsAdmin } from '../lib/admins.js'
import { fill, waitForText } from '../lib/flows.js'
import { approvedRecruiter, jobBody, postJob } from '../lib/recruiters.js'
import { api } from '../lib/testApi.js'

/**
 * P16-03 (owner 2026-11-24, step 3): the sector sites, previewed with `?site=` (the test stack runs on localhost).
 * eujobs.health greets with its own hero line and lists only healthcare jobs; an open job names its home site as the
 * canonical address; leaving the public pages ends the preview. Admin › Website › Sites lists and edits the sites.
 */
export default {
  name: 'P16-03 Sector sites',
  viewports: ['D', 'M'],
  async run(ctx) {
    const tag = ctx.viewport
    const recruiter = await approvedRecruiter(`P1603${tag}`)
    const nurse = await postJob(recruiter.token, jobBody({ title: `Night Nurse ${tag}`, sector: 'healthcare' }))

    // 1. The health site: its hero, its jobs only, the canonical address of an open job.
    const visitor = await ctx.newPage(null)
    const { page } = visitor
    await page.goto(`${ctx.webUrl}/?site=eujobs.health`, { waitUntil: 'networkidle0' })
    await page.waitForSelector('[data-site-title="eujobs.health"]')
    const title = (await api('/meta/site?host=eujobs.health')).body.site.title.en
    ctx.check((await page.$eval('[data-hero-title]', (line) => line.innerText)) === title, `the health site has its own hero line (${title})`)
    await visitor.checkOverflow()
    await ctx.screenshot(page, '1-health-landing')
    const sectorLinks = await page.$$eval('[data-sector-link]', (links) => links.map((link) => link.dataset.sectorLink))
    ctx.check(sectorLinks.length === 1 && sectorLinks[0] === 'healthcare', `the health site counts only healthcare jobs (${sectorLinks.join(', ')})`)

    await page.goto(`${ctx.webUrl}/jobs`, { waitUntil: 'networkidle0' })
    await page.waitForSelector('[data-row]')
    const rows = await page.$$eval('[data-row]', (items) => items.map((item) => item.innerText))
    // The seed has healthcare jobs too (2026-11-26): every row is one of the API's healthcare jobs.
    const healthcare = (await api('/landing/jobs?sector=healthcare')).body.items.map((job) => job.title)
    ctx.check(rows.length >= 1 && rows.every((text) => healthcare.some((jobTitle) => text.includes(jobTitle))), `/jobs on the health site lists healthcare jobs only (${rows.length})`)
    await page.goto(`${ctx.webUrl}/jobs?job=${nurse.id}`, { waitUntil: 'networkidle0' })
    await page.waitForSelector('link[rel="canonical"]')
    const canonical = await page.$eval('link[rel="canonical"]', (link) => link.href)
    ctx.check(canonical === `https://eujobs.health/jobs?job=${nurse.id}`, `the open job names its home site (${canonical})`)
    await ctx.screenshot(page, '2-health-jobs')

    // 2. Signing in is a main-site page: the preview ends and the main home page is back.
    await page.goto(`${ctx.webUrl}/sign-in`, { waitUntil: 'networkidle0' })
    await page.goto(`${ctx.webUrl}/`, { waitUntil: 'networkidle0' })
    await page.waitForSelector('[data-hero-title]')
    ctx.check(!(await page.$('[data-site-title]')) && (await page.$eval('[data-hero-title]', (line) => line.innerText)) === 'Find a Dream Job', 'after sign-in the main site is shown again')
    ctx.assertClean(visitor.issues, 'sector site')

    // 3. Admin › Website › Sites
    const admin = await ctx.newPage()
    await openAsAdmin(ctx, admin, ctx.seedCredentials.email(), '/admin/website/sites', ctx.seedCredentials.password)
    await admin.page.waitForSelector('[data-site="eujobs.health"]')
    const hosts = await admin.page.$$eval('[data-site]', (cells) => cells.map((cell) => cell.dataset.site))
    ctx.check(['eujobs.art', 'eujobs.foundation', 'eujobs.health', 'eujobs.online', 'eujobs.tech'].every((host) => hosts.includes(host)), `the starter sites are listed (${hosts.join(', ')})`)
    const healthRow = await admin.page.$eval('[data-site="eujobs.health"]', (cell) => cell.closest('tr').innerText)
    ctx.check(healthRow.includes('Healthcare') && healthRow.includes('On'), 'the health site lists Healthcare and is on')
    await admin.checkOverflow()
    await ctx.screenshot(admin.page, '3-admin-sites')
    await admin.page.$eval('[data-site="eujobs.health"]', (cell) => [...cell.closest('tr').querySelectorAll('button')].find((button) => button.innerText.trim() === 'Edit').click())
    await admin.page.waitForSelector('input[name="site-title-en"]')
    await fill(admin.page, 'input[name="site-title-en"]', `Care Jobs ${tag}`)
    await ctx.screenshot(admin.page, '4-edit-site')
    await admin.page.click('button[form="site-form"]')
    await waitForText(admin.page, 'Site saved: eujobs.health')
    await admin.page.waitForFunction((title) => document.querySelector('[data-site="eujobs.health"]')?.innerText.includes(title), {}, `Care Jobs ${tag}`)
    ctx.check(true, 'an edited hero line shows in the list')
    ctx.assertClean(admin.issues, 'admin sites')
  },
}
