import { openAsAdmin } from '../lib/admins.js'
import { approvedAgency, dayFromToday } from '../lib/agencies.js'
import { bodyText, clickText, fill, finishLoginStep, responseTo, waitForPath, waitForText } from '../lib/flows.js'
import { approvedRecruiter, jobBody, postJob } from '../lib/recruiters.js'
import { api, TEST_PASSWORD } from '../lib/testApi.js'

/**
 * P15-04 (agencies, phase 7): a visitor's landing page with the Agency jobs section (client or confidential client,
 * dates, pay rate; "See all agency jobs" opens the /jobs Agency tab), the "For agencies" band, the header's Agencies
 * link and the footer's agency links; the For agencies pricing tab on the landing page and on /pricing (agency
 * features, sign-up to /agencies/signup). The admin sees the agency plans in Payments › Plans, the Agency MRR line
 * and the Agency Plus caps on the Usage tab (read, never saved: the database is shared). Desktop and phone, landing
 * in dark.
 */
const TITLE = 'Harbour Crane Operator'

export default {
  name: 'P15-04 Agency plans and landing',
  viewports: ['D', 'M'],
  async run(ctx) {
    const phone = ctx.viewport === 'M'

    // Setup: an agency with a shown client and a published agency job (the newest one, so it leads the section).
    const agency = await approvedAgency('P1504')
    const acme = (await api('/agency/clients', { method: 'POST', token: agency.token, body: { name: 'Acme Ports' } })).body
    const job = await postJob(agency.token, jobBody({ title: TITLE, agency: { clientId: acme.id, showClient: true, startDate: dayFromToday(5), endDate: dayFromToday(35), rate: { amountMinor: 1650, period: 'hour' } } }))

    const handle = await ctx.newPage()
    const { page } = handle

    // 1. Landing: the Agency jobs section right after the latest jobs, then the band.
    await page.goto(`${ctx.webUrl}/`, { waitUntil: 'networkidle0' })
    await page.waitForSelector('#agency-jobs')
    const section = await page.$eval('#agency-jobs', (element) => ({
      text: element.innerText,
      after: element.previousElementSibling?.id,
      band: element.nextElementSibling?.hasAttribute('data-agency-band'),
      more: element.querySelector('a[href="/jobs?employmentType=agency"]')?.textContent.trim(),
    }))
    ctx.check(section.text.includes(TITLE), 'the agency job is in the Agency jobs section')
    ctx.check(section.text.includes('For Acme Ports') && section.text.includes('£16.50 per hour'), 'the row shows the client and the pay rate')
    ctx.check(section.after === 'jobs' && section.band, `the section follows the latest jobs and the band follows it (${section.after}, ${section.band})`)
    ctx.check(Boolean(section.more), 'the section links to all agency jobs')
    const band = await page.$eval('[data-agency-band]', (element) => [...element.querySelectorAll('a')].map((link) => link.getAttribute('href')))
    ctx.check(band.includes('/agencies') && band.includes('/agencies/signup'), `the band links to /agencies and sign-up (${band.join(', ')})`)
    await page.$eval('#agency-jobs', (element) => element.scrollIntoView({ block: 'start' }))
    await new Promise((resolve) => setTimeout(resolve, 900))
    await handle.checkOverflow()
    await ctx.screenshot(page, '1-landing-agency-jobs')
    await page.$eval('[data-agency-band]', (element) => element.scrollIntoView({ block: 'center' }))
    await new Promise((resolve) => setTimeout(resolve, 900))
    await ctx.screenshot(page, '2-landing-agency-band')

    // 2. The header's Agencies item (after Jobs) and the footer's agency links.
    const nav = await page.$$eval('header nav a', (links) => links.map((link) => [link.textContent.trim(), link.getAttribute('href')]))
    const jobsAt = nav.findIndex(([, href]) => href === '/#jobs')
    ctx.check(jobsAt >= 0 && nav[jobsAt + 1]?.[1] === '/agencies' && nav[jobsAt + 1][0] === 'Agencies', `Agencies follows Jobs in the header (${nav.map(([label]) => label).join(', ')})`)
    const footer = await page.$$eval('footer nav a', (links) => links.map((link) => [link.textContent.trim(), link.getAttribute('href')]))
    ctx.check(footer.some(([label, href]) => label === 'Agencies' && href === '/agencies'), 'the footer lists Agencies')
    ctx.check(footer.some(([label, href]) => label === 'Agency sign in' && href === '/agencies/login'), 'the footer lists Agency sign in')

    // 3. The landing pricing section's For agencies tab.
    await page.$eval('#pricing', (element) => element.scrollIntoView({ block: 'start' }))
    await clickText(page, 'For agencies', '#pricing [role="tab"]')
    await page.waitForSelector('#pricing [data-plan="agency_plus"]')
    const pricing = await page.$eval('#pricing', (element) => ({ text: element.innerText, signUp: [...element.querySelectorAll('[data-plan] a')].map((link) => link.getAttribute('href')) }))
    ctx.check(pricing.text.includes('AI reads your agreement and contracts and suggests the rules'), 'Agency Plus lists its agency features')
    ctx.check(pricing.signUp.length === 2 && pricing.signUp.every((href) => href === '/agencies/signup'), `both agency cards sign up at /agencies/signup (${pricing.signUp.join(', ')})`)
    await new Promise((resolve) => setTimeout(resolve, 1200))
    await handle.checkOverflow()
    await ctx.screenshot(page, '3-landing-pricing-agencies')

    // 4. The details link opens /pricing on the same tab.
    await page.click('#pricing a[href="/pricing?for=agency"]')
    await waitForPath(page, () => location.pathname === '/pricing' && location.search === '?for=agency')
    await page.waitForSelector('[data-plan="agency_free"]')
    const selected = await page.$eval('[role="tab"][aria-selected="true"]', (tab) => tab.textContent.trim())
    ctx.check(selected === 'For agencies', `/pricing opens on For agencies (${selected})`)
    ctx.check((await bodyText(page)).includes('Talent on your books, with your own versioned agreement'), 'Agency Free lists the books')
    await handle.checkOverflow()
    await ctx.screenshot(page, '4-pricing-agencies')

    // 5. See all agency jobs: the /jobs Agency tab with the job.
    await page.goto(`${ctx.webUrl}/`, { waitUntil: 'networkidle0' })
    await page.waitForSelector('#agency-jobs')
    await page.click('#agency-jobs a[href="/jobs?employmentType=agency"]')
    await waitForPath(page, () => location.pathname === '/jobs' && location.search.includes('employmentType=agency'))
    await waitForText(page, TITLE)
    const tab = await page.$eval('[role="tab"][aria-selected="true"]', (element) => element.textContent)
    ctx.check(tab.startsWith('Agency'), `/jobs opens on the Agency tab (${tab})`)
    ctx.assertClean(handle.issues, 'visitor pages')

    // 6. Dark mode: the band and the agency rows.
    if (!phone) {
      await page.evaluate(() => localStorage.setItem('lwm-pref-theme', 'dark'))
      await page.goto(`${ctx.webUrl}/`, { waitUntil: 'networkidle0' })
      await page.waitForSelector('#agency-jobs')
      await page.$eval('#agency-jobs', (element) => element.scrollIntoView({ block: 'start' }))
      await new Promise((resolve) => setTimeout(resolve, 900))
      await ctx.screenshot(page, '5-landing-agency-dark')
      await page.$eval('[data-agency-band]', (element) => element.scrollIntoView({ block: 'center' }))
      await new Promise((resolve) => setTimeout(resolve, 900))
      await ctx.screenshot(page, '5b-landing-band-dark')
      await page.evaluate(() => localStorage.setItem('lwm-pref-theme', 'light'))
      ctx.assertClean(handle.issues, 'dark landing')
    }

    // 6b. (2026-11-23) Every sign-in picker offers Agency; a recruiter on the Agency tile with the right password is
    // told its account type and signs in as a recruiter from the same form.
    const recruiter = await approvedRecruiter('P1504R')
    const signIn = await ctx.newPage()
    signIn.allow(403, '/api/v1/auth/login')
    await signIn.page.goto(`${ctx.webUrl}/agencies/login`, { waitUntil: 'networkidle0' })
    const tiles = await signIn.page.$$eval('[role="radiogroup"] [role="radio"]', (els) => els.map((el) => el.textContent.trim()))
    ctx.check(tiles.join() === 'Candidate,Recruiter,Agency', `the picker offers every workspace (${tiles.join(', ')})`)
    await fill(signIn.page, 'input[name="email"]', recruiter.email)
    await fill(signIn.page, 'input[name="password"]', TEST_PASSWORD)
    const refused = responseTo(signIn.page, '/api/v1/auth/login', 'POST')
    await signIn.page.click('button[type="submit"]')
    ctx.check((await refused).status() === 403, 'the agency tile refuses a recruiter')
    await signIn.page.waitForSelector('[data-wrong-portal="recruiter"]')
    ctx.check((await bodyText(signIn.page)).includes('This is a Recruiter account. Choose Recruiter to sign in.'), 'the message names the account type')
    await ctx.screenshot(signIn.page, '6-wrong-tile')
    const login = responseTo(signIn.page, '/api/v1/auth/login', 'POST')
    await signIn.page.click('[data-wrong-portal="recruiter"]')
    const step = (await (await login).json().catch(() => null))?.verification
    if (step) await finishLoginStep(signIn.page, recruiter.email, step.method)
    await waitForPath(signIn.page, () => location.pathname.startsWith('/recruiter') && !location.pathname.includes('sign-in'))
    ctx.assertClean(signIn.issues, 'wrong-tile sign-in')

    // 7. Admin: the agency plans, the Agency MRR line and the Agency Plus caps (read only).
    const admin = await ctx.newPage()
    await openAsAdmin(ctx, admin, ctx.seedCredentials.email(), '/admin/payments/plans', ctx.seedCredentials.password)
    await admin.page.waitForSelector('[data-admin-plan="agency_plus"]')
    const plans = await admin.page.$eval('#plans-agency', (heading) => [heading.textContent.trim(), [...heading.parentElement.querySelectorAll('[data-admin-plan]')].map((card) => card.dataset.adminPlan)])
    ctx.check(plans[0] === 'Agencies' && plans[1].join() === 'agency_free,agency_plus', `Plans has an Agencies section (${plans.flat().join(', ')})`)
    await admin.checkOverflow()
    await ctx.screenshot(admin.page, '6-admin-plans-agencies')

    await admin.page.goto(`${ctx.webUrl}/admin/payments`, { waitUntil: 'networkidle0' })
    await admin.page.waitForSelector('[data-mrr-role="agency"]')
    ctx.check((await admin.page.$eval('[data-mrr-role="agency"]', (line) => line.innerText)).includes('Agenc'), 'the MRR card has an Agency line')
    await ctx.screenshot(admin.page, '7-admin-payments')

    await admin.page.goto(`${ctx.webUrl}/admin/ai-matching/usage`, { waitUntil: 'networkidle0' })
    await admin.page.waitForSelector('[data-cap="agency_plus.month"]')
    const caps = await admin.page.$$eval('[data-cap^="agency_plus."]', (fields) => fields.map((field) => (field.matches('input') ? field : field.querySelector('input')).value))
    ctx.check(caps.length === 2 && caps.every((value) => Number(value) > 0), `the Usage tab shows the Agency Plus caps (${caps.join(' / ')})`)
    await admin.page.$eval('[data-cap="agency_plus.month"]', (field) => field.scrollIntoView({ block: 'center' }))
    await admin.checkOverflow()
    await ctx.screenshot(admin.page, '8-admin-usage-caps')
    ctx.assertClean(admin.issues, 'admin pages')
    ctx.check(Boolean(job.id), 'setup job published')
  },
}
