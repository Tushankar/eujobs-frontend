import { approvedAgency } from '../lib/agencies.js'
import { openAsAdmin } from '../lib/admins.js'
import { clickText, fill, pageApi, signInWithForm, waitForText } from '../lib/flows.js'
import { approvedRecruiter } from '../lib/recruiters.js'
import { api, TEST_PASSWORD } from '../lib/testApi.js'

const value = (page, selector) => page.$eval(selector, (field) => field.value)
const optionValues = (page, selector) => page.$$eval(`${selector} option`, (options) => options.map((option) => option.value))

/**
 * P16-01 (owner 2026-11-24): job sectors and volunteer jobs. Admin › Website › Sectors lists the starter sectors, adds
 * one in three languages and hides it. A recruiter's Company page and new job start in the company's sector; a
 * volunteer job has no salary. An agency job starts without a sector, never offers Volunteer, and takes its client's
 * sector when the client is picked.
 */
export default {
  name: 'P16-01 Job sectors and volunteer jobs',
  viewports: ['D', 'M'],
  async run(ctx) {
    const tag = ctx.viewport
    // 1. Admin › Website › Sectors
    const admin = await ctx.newPage()
    await openAsAdmin(ctx, admin, ctx.seedCredentials.email(), '/admin/website/sectors', ctx.seedCredentials.password)
    const { page } = admin
    await page.waitForSelector('[data-sector="healthcare"]')
    ctx.check((await page.$eval('[data-sector="healthcare"]', (cell) => cell.innerText)).includes('Healthcare'), 'the starter sectors are listed')
    await admin.checkOverflow()
    await ctx.screenshot(page, '1-admin-sectors')
    const english = `Green Energy ${tag}`
    await page.click('[data-add-sector]')
    await page.waitForSelector('input[name="sector-en"]')
    await fill(page, 'input[name="sector-en"]', english)
    await fill(page, 'input[name="sector-es"]', `Energía verde ${tag}`)
    await fill(page, 'input[name="sector-fr"]', `Énergie verte ${tag}`)
    await ctx.screenshot(page, '2-add-sector')
    await page.click('button[form="sector-form"]')
    await waitForText(page, `Sector added: ${english}`)
    const key = `green_energy_${tag.toLowerCase()}`
    await page.waitForSelector(`[data-sector="${key}"]`)
    const row = () => page.$eval(`[data-sector="${key}"]`, (cell) => cell.closest('tr').innerText)
    ctx.check((await row()).includes('Shown') && (await row()).includes('0 jobs · 0 live'), 'the new sector is shown with no jobs')
    await page.$eval(`[data-sector="${key}"]`, (cell) => [...cell.closest('tr').querySelectorAll('button')].find((button) => button.innerText.trim() === 'Hide').click())
    await waitForText(page, `${english} is hidden`)
    await page.waitForFunction((sel) => document.querySelector(sel)?.closest('tr').innerText.includes('Hidden'), {}, `[data-sector="${key}"]`)
    ctx.check(true, 'hiding a sector marks it Hidden')
    await ctx.screenshot(page, '3-sector-hidden')
    ctx.assertClean(admin.issues, 'admin sectors')

    // 2. A recruiter: the Company page and a new job start in the company's sector; volunteer jobs have no salary.
    const recruiter = await approvedRecruiter(`P1601${tag}`)
    const hiring = await ctx.newPage()
    await signInWithForm(hiring.page, ctx.webUrl, '/recruiter/sign-in', recruiter.email, TEST_PASSWORD)
    await hiring.page.goto(`${ctx.webUrl}/recruiter/company`, { waitUntil: 'networkidle0' })
    await hiring.page.waitForSelector('select[name="sector"]')
    ctx.check((await value(hiring.page, 'select[name="sector"]')) === 'it_software', 'the Company page shows the company sector')
    ctx.check(!(await optionValues(hiring.page, 'select[name="sector"]')).includes(key), 'a hidden sector is not offered')
    await ctx.screenshot(hiring.page, '4-company-sector')

    await hiring.page.goto(`${ctx.webUrl}/recruiter/jobs/new`, { waitUntil: 'networkidle0' })
    await hiring.page.waitForSelector('select[name="sector"]')
    ctx.check((await value(hiring.page, 'select[name="sector"]')) === 'it_software', 'a new job starts in the company sector')
    ctx.check((await optionValues(hiring.page, 'select[name="employmentType"]')).includes('volunteer'), 'recruiters can post volunteer jobs')
    await fill(hiring.page, 'input[name="title"]', 'Community Garden Volunteer')
    await hiring.page.select('select[name="employmentType"]', 'volunteer')
    await hiring.page.select('select[name="sector"]', 'charity_nonprofit')
    await hiring.checkOverflow()
    await ctx.screenshot(hiring.page, '5-job-basics')
    await clickText(hiring.page, 'Continue', 'button[type="submit"]')
    await hiring.page.waitForFunction(() => /\/jobs\/[a-f0-9]{24}\/edit/.test(location.pathname))
    const jobId = hiring.page.url().match(/jobs\/([a-f0-9]{24})/)[1]
    const draft = (await api(`/recruiter/jobs/${jobId}`, { token: recruiter.token })).body
    ctx.check(draft.sector === 'charity_nonprofit' && draft.employmentType === 'volunteer', `the draft keeps the sector and type (${draft.sector}, ${draft.employmentType})`)
    await hiring.page.goto(`${ctx.webUrl}/recruiter/jobs/${jobId}/edit?step=5`, { waitUntil: 'networkidle0' })
    await waitForText(hiring.page, 'Volunteer roles are unpaid')
    ctx.check(!(await hiring.page.$('input[name="salaryMin"]')), 'a volunteer job has no salary fields')
    await ctx.screenshot(hiring.page, '6-volunteer-location')
    ctx.assertClean(hiring.issues, 'recruiter job')

    // 3. An agency: no sector at first, no Volunteer, the picked client's sector fills it.
    const agency = await approvedAgency(`P1601A${tag}`)
    const client = (await api('/agency/clients', { method: 'POST', token: agency.token, body: { name: `St Mary Clinic ${tag}`, sector: 'healthcare' } })).body
    const agencyPage = await ctx.newPage()
    await signInWithForm(agencyPage.page, ctx.webUrl, '/agencies/login', agency.email, TEST_PASSWORD)
    await agencyPage.page.goto(`${ctx.webUrl}/agency/clients`, { waitUntil: 'networkidle0' })
    await agencyPage.page.waitForSelector(`[data-client="${client.name}"]`)
    ctx.check((await agencyPage.page.$eval(`[data-client="${client.name}"]`, (card) => card.innerText)).includes('Healthcare'), 'the client list shows the sector name')
    await agencyPage.page.goto(`${ctx.webUrl}/agency/jobs/new`, { waitUntil: 'networkidle0' })
    await agencyPage.page.waitForSelector('select[name="sector"]')
    ctx.check((await value(agencyPage.page, 'select[name="sector"]')) === '', 'an agency job starts without a sector')
    ctx.check(!(await optionValues(agencyPage.page, 'select[name="employmentType"]')).includes('volunteer'), 'agencies cannot post volunteer jobs')
    await fill(agencyPage.page, 'input[name="title"]', 'Ward Nurse')
    await clickText(agencyPage.page, 'Continue', 'button[type="submit"]')
    await agencyPage.page.waitForFunction(() => /\/jobs\/[a-f0-9]{24}\/edit/.test(location.pathname))
    const agencyJob = agencyPage.page.url().match(/jobs\/([a-f0-9]{24})/)[1]
    await agencyPage.page.goto(`${ctx.webUrl}/agency/jobs/${agencyJob}/edit?step=6`, { waitUntil: 'networkidle0' })
    await agencyPage.page.waitForSelector('[data-client-picker]')
    await agencyPage.page.click('[data-client-picker]')
    await agencyPage.page.waitForSelector(`[data-client-option="${client.name}"]`)
    ctx.check((await agencyPage.page.$eval(`[data-client-option="${client.name}"]`, (option) => option.innerText)).includes('Healthcare'), 'the client picker shows the sector')
    await agencyPage.page.click(`[data-client-option="${client.name}"]`)
    await agencyPage.page.$$eval('ol button', (buttons) => buttons[0].click())
    await agencyPage.page.waitForSelector('select[name="sector"]')
    ctx.check((await value(agencyPage.page, 'select[name="sector"]')) === 'healthcare', 'picking the client filled the sector')
    await agencyPage.checkOverflow()
    await ctx.screenshot(agencyPage.page, '7-agency-sector-from-client')
    ctx.assertClean(agencyPage.issues, 'agency job')
  },
}
