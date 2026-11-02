import { clickText, fill, pageApi, signInWithForm, waitForPath, waitForText } from '../lib/flows.js'
import { approvedRecruiter, login, postJob } from '../lib/recruiters.js'
import { TEST_PASSWORD } from '../lib/testApi.js'

const continueStep = async (page) => clickText(page, 'Continue', 'button[type="submit"]')
/** Continue, then wait until the next step's heading shows (each Continue saves the draft first). */
async function next(page, heading) {
  await continueStep(page)
  await page.waitForFunction((text) => document.querySelector('form h2')?.textContent === text, {}, heading)
}

/**
 * P4-07 (M-033, M-039, M-040, M-041, M-060, M-131, U26, P4-D7): a hybrid job in Warsaw gets PLN with a monthly
 * period; the draft exists after step 1 and survives a reload; a skill in both lists and a salary of 100,000,001 are
 * refused; the quality checks list the server's rules; the published job shows in the Published tab; the tabs read
 * published, paused, draft, closed. Publishing an invalid draft from the table menu opens the wizard at its first
 * invalid step.
 */
export default {
  name: 'P4-07 Job wizard',
  viewports: ['D', 'M'],
  async run(ctx) {
    const recruiter = await approvedRecruiter('Wizard')
    const handle = await ctx.newPage()
    const { page } = handle
    handle.allow(422, '/api/v1/recruiter/jobs')
    await signInWithForm(page, ctx.webUrl, '/recruiter/sign-in', recruiter.email, TEST_PASSWORD)
    await page.goto(`${ctx.webUrl}/recruiter/jobs/new`, { waitUntil: 'networkidle0' })

    await fill(page, 'input[name="title"]', 'Senior Product Designer')
    await continueStep(page)
    await waitForPath(page, () => /\/recruiter\/jobs\/[a-f0-9]{24}\/edit/.test(location.pathname))
    const jobId = new URL(page.url()).pathname.split('/')[3]
    const draft = await pageApi(page, `/recruiter/jobs/${jobId}`)
    ctx.check(draft.body.status === 'draft', 'the server draft exists after step 1')
    await page.reload({ waitUntil: 'networkidle0' })
    await page.waitForSelector('textarea[name="brief"]')
    await ctx.screenshot(page, '1-draft-after-reload')

    await fill(page, 'textarea[name="brief"]', 'Lead the design of our hiring tools, from research to shipped product, with a small and kind team in Warsaw.')
    await fill(page, 'textarea[name="responsibilities"]', 'Run research\nDesign flows\nShip with engineers')
    await next(page, 'Required skills')
    for (const skill of ['Figma', 'Design Systems']) {
      await fill(page, 'input[placeholder="Type a skill and press Enter"]', skill)
      await page.keyboard.press('Enter')
    }
    await next(page, 'Preferred skills')
    await fill(page, 'input[placeholder="Type a skill and press Enter"]', 'figma')
    await page.keyboard.press('Enter')
    await waitForText(page, 'figma is already in the other skills list.')
    await fill(page, 'input[placeholder="Type a skill and press Enter"]', 'Prototyping')
    await page.keyboard.press('Enter')
    await next(page, 'Experience & languages')
    await page.select('select[name="level"]', 'senior')
    await fill(page, 'input[name="experienceYears"]', '5')
    await next(page, 'Location & work')

    await page.select('select[name="workPreference"]', 'hybrid')
    await page.type('input[name="jobCity"]', 'Warsaw')
    await page.waitForSelector('[role="option"]')
    await clickText(page, 'Warsaw', '[role="option"]')
    await waitForText(page, 'Minimum salary (PLN)')
    await page.select('select[name="salaryPeriod"]', 'month')
    await fill(page, 'input[name="salaryMin"]', '9000')
    await fill(page, 'input[name="salaryMax"]', '100000001')
    await continueStep(page)
    await waitForText(page, 'Enter 100000000 or less.')
    await fill(page, 'input[name="salaryMax"]', '12000')
    await handle.checkOverflow()
    await ctx.screenshot(page, '2-location')
    await next(page, 'Quality checks')

    await page.waitForSelector('li[data-check="salary_range"]')
    const checks = await page.$$eval('li[data-check]', (items) => items.map((item) => `${item.dataset.check}:${item.dataset.ok}`))
    ctx.check(checks.join(',') === 'title_words:true,brief_length:false,responsibilities:true,required_skills:false,salary_range:true', `the quality checks are the server rules (got ${checks})`)
    await ctx.screenshot(page, '3-quality-checks')
    await next(page, 'Review')
    await next(page, 'Publish')
    await clickText(page, 'Publish job', 'button')
    await waitForPath(page, `/recruiter/jobs/${jobId}`)
    await waitForText(page, 'Job published. It now appears in your open roles.')
    const job = (await pageApi(page, `/recruiter/jobs/${jobId}`)).body
    ctx.check(job.status === 'published' && job.country === 'PL', 'published in Poland')
    ctx.check(JSON.stringify(job.salary) === JSON.stringify({ min: 9000, max: 12000, currency: 'PLN', period: 'month' }), `the salary is PLN a month (got ${JSON.stringify(job.salary)})`)
    ctx.check(JSON.stringify(job.preferredSkills) === '["Prototyping"]', 'figma was not added to the preferred skills')
    await ctx.screenshot(page, '4-published')

    await page.goto(`${ctx.webUrl}/recruiter/jobs`, { waitUntil: 'networkidle0' })
    const tabs = await page.$$eval('[aria-label="Filter jobs by status"] button', (buttons) => buttons.map((button) => button.textContent.trim()))
    ctx.check(tabs.join(',') === 'All jobs,Published,Paused,Draft,Closed', `the tab order (got ${tabs})`)
    await clickText(page, 'Published', '[aria-label="Filter jobs by status"] button')
    await waitForText(page, 'Senior Product Designer')

    // An incomplete draft published from the table menu opens the wizard at the first invalid step (M-039).
    await postJob(await login(recruiter.email), { title: 'Incomplete draft role', employmentType: 'contract' }, { draft: true })
    await clickText(page, 'All jobs', '[aria-label="Filter jobs by status"] button')
    await page.click('button[aria-label="Manage Incomplete draft role"]')
    await clickText(page, 'Publish job', 'button')
    await waitForPath(page, () => location.pathname.endsWith('/edit') && location.search.includes('step=1'))
    await page.waitForFunction(() => document.querySelector('form h2')?.textContent === 'Responsibilities')
    await waitForText(page, 'This field is required.')
    await handle.checkOverflow()
    await ctx.screenshot(page, '5-invalid-draft')
    ctx.assertClean(handle.issues, 'wizard')
  },
}
