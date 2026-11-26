import { clickText, fill, signInWithForm, waitForText } from '../lib/flows.js'
import { approvedRecruiter, jobBody, login, postJob } from '../lib/recruiters.js'
import { api } from '../lib/testApi.js'

/**
 * P16-02 (owner 2026-11-24, step 2): finding jobs by sector. The landing page lists the sectors with open jobs and
 * opens /jobs on one; /jobs has a sector filter with counts and shows the job's sector; Find jobs takes `?sector=` and
 * shows the sector on cards; a job alert can be only sectors; preferred sectors show on the candidate's profile.
 */
export default {
  name: 'P16-02 Find jobs by sector',
  viewports: ['D', 'M'],
  async run(ctx) {
    const tag = ctx.viewport
    const recruiter = await approvedRecruiter(`P1602${tag}`)
    const nurse = await postJob(recruiter.token, jobBody({ title: `Ward Nurse ${tag}`, sector: 'healthcare' }))

    // 1. Landing → /jobs?sector=healthcare
    const visitor = await ctx.newPage(null)
    const { page } = visitor
    await page.goto(ctx.webUrl, { waitUntil: 'networkidle0' })
    await page.waitForSelector('[data-landing-sectors] [data-sector-link="healthcare"]')
    const links = await page.$$eval('[data-sector-link]', (items) => items.map((item) => item.innerText.replace(/\s+/g, ' ')))
    ctx.note(`landing sectors: ${links.join(' | ')}`)
    ctx.check(links.some((text) => text.startsWith('IT & Software')) && links.some((text) => text.startsWith('Healthcare')), 'the landing lists the sectors with open jobs')
    await page.$eval('[data-landing-sectors]', (section) => section.scrollIntoView({ block: 'center' }))
    await ctx.screenshot(page, '1-landing-sectors')
    await page.click('[data-sector-link="healthcare"]')
    await page.waitForFunction(() => location.pathname === '/jobs' && location.search.includes('sector=healthcare'))
    await page.waitForSelector('[data-row]')
    const rows = await page.$$eval('[data-row]', (items) => items.map((item) => item.innerText))
    // The seed has healthcare jobs too (2026-11-26): every row is one of the API's healthcare jobs, ours included.
    const healthcare = (await api('/landing/jobs?sector=healthcare')).body.items.map((job) => job.title)
    ctx.check(rows.some((text) => text.includes(`Ward Nurse ${tag}`)) && rows.every((text) => healthcare.some((title) => text.includes(title))), `only healthcare jobs are listed (${rows.length})`)
    ctx.check((await page.$eval('select[name="sector"]', (field) => field.value)) === 'healthcare', 'the sector filter shows the chosen sector')
    await page.waitForSelector('[data-detail] [data-job-sector="healthcare"]')
    await visitor.checkOverflow()
    await ctx.screenshot(page, '2-public-jobs-sector')
    await page.select('select[name="sector"]', '')
    await page.waitForFunction(() => !location.search.includes('sector='))
    ctx.check(true, 'All sectors clears the filter')
    ctx.assertClean(visitor.issues, 'public pages')

    // 2. Find jobs, a sector-only alert and preferred sectors (Emma, Plus).
    const emma = await ctx.newPage()
    await signInWithForm(emma.page, ctx.webUrl, '/sign-in', ctx.seedCredentials.email('emma'), ctx.seedCredentials.password)
    await emma.page.goto(`${ctx.webUrl}/candidate/jobs?sector=healthcare`, { waitUntil: 'networkidle0' })
    await emma.page.waitForSelector(`article[data-job="${nurse.id}"] [data-job-sector="healthcare"]`)
    const sectorsShown = await emma.page.$$eval('article[data-job]', (items) => items.map((item) => item.querySelector('[data-job-sector]')?.dataset.jobSector))
    ctx.check(sectorsShown.length >= 1 && sectorsShown.every((key) => key === 'healthcare'), `Find jobs keeps ?sector= (${sectorsShown.join(', ')})`)
    await clickText(emma.page, 'Filters', 'button')
    await waitForText(emma.page, 'Sector')
    await emma.checkOverflow()
    await ctx.screenshot(emma.page, '3-find-jobs-filters')
    await emma.page.keyboard.press('Escape')

    await emma.page.goto(`${ctx.webUrl}/candidate/job-alerts`, { waitUntil: 'networkidle0' })
    await emma.page.waitForSelector('[data-create-alert]')
    await emma.page.click('[data-create-alert]')
    await emma.page.waitForSelector('[data-sector-picker="alertSectors"] [data-sector-option="healthcare"]')
    await fill(emma.page, 'input[name="alertName"]', `Care jobs ${tag}`)
    await emma.page.click('[data-sector-option="healthcare"]')
    await ctx.screenshot(emma.page, '4-alert-sectors')
    await emma.page.click('button[form="job-alert-form"]')
    await emma.page.waitForSelector(`[data-alert-name="Care jobs ${tag}"] [data-alert-criteria]`)
    ctx.check((await emma.page.$eval(`[data-alert-name="Care jobs ${tag}"] [data-alert-criteria]`, (line) => line.innerText)) === 'Healthcare', 'a sector-only alert saves and lists its sector')
    await ctx.screenshot(emma.page, '5-alerts-list')

    const token = await login(ctx.seedCredentials.email('emma'), 'candidate', ctx.seedCredentials.password)
    const profile = (await api('/candidate/profile', { token })).body
    const body = { fullName: profile.fullName, headline: profile.headline, placeId: profile.location.placeId, about: profile.about, yearsExperience: profile.yearsExperience, skills: profile.skills, workPreference: profile.workPreference, availability: profile.availability, salaryMin: profile.salaryMin, preferredSectors: ['healthcare', 'arts_culture'] }
    const saved = await api('/candidate/profile', { method: 'PUT', token, body })
    ctx.check(saved.status === 200, `preferred sectors save (${saved.status})`)
    await emma.page.goto(`${ctx.webUrl}/candidate/profile`, { waitUntil: 'networkidle0' })
    await emma.page.waitForSelector('[data-preferred-sector="healthcare"]')
    ctx.check(Boolean(await emma.page.$('[data-preferred-sector="arts_culture"]')), 'the profile shows both preferred sectors')
    await emma.page.$eval('[data-preferred-sector="healthcare"]', (pill) => pill.scrollIntoView({ block: 'center' }))
    await ctx.screenshot(emma.page, '6-profile-sectors')
    ctx.assertClean(emma.issues, 'candidate pages')
  },
}
