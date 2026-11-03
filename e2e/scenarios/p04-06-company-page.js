import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fixture } from '../fixtures/make.js'
import { chooseFile, clickText, fill, pageApi, signInWithForm, waitForText } from '../lib/flows.js'
import { approvedRecruiter, jobBody, login, postJob } from '../lib/recruiters.js'
import { api, db, TEST_PASSWORD } from '../lib/testApi.js'

const UPLOAD_ROOT = 'C:/eujobs-data/uploads/_test'

/**
 * P4-06 (M-146, M-147, M-150, G-1): the recruiter edits display name, industry, size, city, website and description;
 * the legal name is read-only. A PNG logo shows on the candidate job cards. An SVG with <script> and on* attributes
 * is stored without them. A 3 MB logo is refused. Without a logo the letter tile keeps its colour after a reload.
 */
export default {
  name: 'P4-06 Company page',
  viewports: ['D', 'M'],
  async run(ctx) {
    const recruiter = await approvedRecruiter('Company')
    const token = await login(recruiter.email)
    await postJob(token, jobBody({ title: 'Logo check designer' }))
    const handle = await ctx.newPage()
    const { page } = handle
    await signInWithForm(page, ctx.webUrl, '/recruiter/sign-in', recruiter.email, TEST_PASSWORD)
    await page.goto(`${ctx.webUrl}/recruiter/company`, { waitUntil: 'networkidle0' })
    await waitForText(page, `Legal name: ${recruiter.company.legalName}`)
    ctx.check(!(await page.$('input[name="legalName"]')), 'the legal name is not editable')

    await fill(page, 'input[name="displayName"]', 'Northlight')
    await fill(page, 'input[name="industry"]', 'Product design')
    await page.select('select[name="size"]', '51_200')
    await fill(page, 'input[name="companyCity"]', 'Manchester')
    await page.waitForSelector('[role="option"]')
    await clickText(page, 'Manchester', '[role="option"]')
    await page.waitForFunction(() => document.querySelector('input[name="companyCity"]').value.includes(','))
    await fill(page, 'input[name="website"]', 'https://northlight.example.com')
    await fill(page, 'textarea[name="description"]', 'We design calm, accessible software for busy hiring teams across Europe.')
    await clickText(page, 'Save company profile', 'button[type="submit"]')
    await waitForText(page, 'Company profile saved.')
    const company = (await pageApi(page, '/recruiter/company')).body
    ctx.check(company.displayName === 'Northlight' && company.size === '51_200' && company.location.city === 'Manchester', 'the public fields are saved')
    ctx.check(company.legalName === recruiter.company.legalName, 'the legal name is unchanged')
    await handle.checkOverflow()
    await ctx.screenshot(page, '1-saved')

    // A letter tile until a logo exists; its colour comes from the id, so it is the same after a reload.
    const tileClass = () => page.$eval('span[role="img"][aria-label="Northlight logo"]', (tile) => tile.className)
    const before = await tileClass()
    await page.reload({ waitUntil: 'networkidle0' })
    ctx.check((await tileClass()) === before, 'the letter tile keeps its colour after a reload')

    handle.allow(413, '/api/v1/recruiter/company/logo')
    await chooseFile(page, 'input[type="file"]', fixture('logo-3mb.png'))
    await waitForText(page, 'logo-3mb.png is larger than 2 MB')
    await chooseFile(page, 'input[type="file"]', fixture('logo.png'))
    await page.waitForSelector('img[alt="Northlight logo"]')
    await ctx.screenshot(page, '2-png-logo')

    const emmaToken = await login(ctx.seedCredentials.email('emma'), 'candidate', ctx.seedCredentials.password)
    const card = (await api('/jobs?q=logo%20check', { token: emmaToken })).body.items[0]
    ctx.check(card?.company.logoUrl, 'the candidate job card carries the logo')
    const emma = await ctx.newPage()
    await signInWithForm(emma.page, ctx.webUrl, '/sign-in', ctx.seedCredentials.email('emma'), ctx.seedCredentials.password)
    await emma.page.goto(`${ctx.webUrl}/candidate/jobs`, { waitUntil: 'networkidle0' })
    await emma.page.waitForSelector(`article[data-job="${card.id}"] img[alt="Northlight logo"]`)
    await ctx.screenshot(emma.page, '3-candidate-card')
    ctx.assertClean(emma.issues, 'candidate jobs')

    const pngSrc = await page.$eval('img[alt="Northlight logo"]', (img) => img.src)
    await chooseFile(page, 'input[type="file"]', fixture('logo-script.svg'))
    await page.waitForFunction((previous) => {
      const src = document.querySelector('img[alt="Northlight logo"]')?.src
      return src && src !== previous
    }, {}, pngSrc)
    const pending = new Map()
    const started = (request) => pending.set(request, Date.now())
    const ended = (request) => pending.delete(request)
    page.on('request', started); page.on('requestfinished', ended); page.on('requestfailed', ended)
    try { await page.waitForNetworkIdle({ timeout: 20000 }) } catch (error) { ctx.note('DEBUG idle wait failed: ' + error.message + ' | pending: ' + [...pending].map(([r, t]) => r.method() + ' ' + r.url().replace(/sig=[^&]+/, 'sig=…') + ' ' + (Date.now() - t) + 'ms').join(' ; ')); throw error }
    ctx.note('DEBUG idle ok; still tracked: ' + [...pending].map(([r]) => r.url().slice(-60)).join(' ; '))
    const [stored] = await db('files', 'find', { filter: { ownerId: { $oid: (await api('/me', { token })).body.id }, purpose: 'company_logo' } })
    const served = readFileSync(join(UPLOAD_ROOT, stored.path), 'utf8')
    ctx.check(!/script|onload|onclick/i.test(served) && served.includes('<rect'), 'the served SVG has no script and no on* attribute')

    await clickText(page, 'Remove logo', 'button')
    await page.waitForSelector('span[role="img"][aria-label="Northlight logo"]')
    ctx.check((await tileClass()) === before, 'the letter tile is back with the same colour')
    await handle.checkOverflow()
    await ctx.screenshot(page, '4-letter-tile')
    ctx.assertClean(handle.issues, 'company page')
  },
}
