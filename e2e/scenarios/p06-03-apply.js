import { applyApi, clickApply, completeCandidate, MINUTE, recruiterWithJob, setTextarea, tickIn } from '../lib/applicants.js'
import { clickText, pageApi, signInWithForm, toggleCheckbox, waitForText } from '../lib/flows.js'
import { mailTo } from '../lib/testApi.js'

const badge = (page) => page.evaluate(() => document.querySelector('[data-nav-badge="applications"]')?.textContent ?? null)
const alerts = (page) => page.$$eval('[data-apply-dialog] [role="alert"]', (items) => items.map((item) => item.textContent))

/**
 * P6-03 (M-073, M-094, OD14): Emma applies through the dialog: the live CV by default, a 2,001-character note and a
 * missing consent are refused, then the application shows "Applied" with a dated history and the sidebar badge
 * counts it. The recruiter gets "1 new application" an hour later; a second application waits for the next hour.
 */
export default {
  name: 'P6-03 Apply',
  viewports: ['D', 'M'],
  async run(ctx) {
    // A recruiter of our own per viewport: their address is not reserved, so the email is captured.
    const { recruiter, job } = await recruiterWithJob(`Apply${ctx.viewport}`)
    const handle = await ctx.newPage()
    const { page } = handle
    await signInWithForm(page, ctx.webUrl, '/sign-in', ctx.seedCredentials.email('emma'), ctx.seedCredentials.password)
    await page.goto(`${ctx.webUrl}/candidate/jobs/${job.id}`, { waitUntil: 'networkidle0' })
    const before = (await pageApi(page, '/me/counters')).body.activeApplications

    await clickApply(page)
    await page.waitForSelector('[data-apply-dialog]', { visible: true })
    const live = (await pageApi(page, '/candidate/cv')).body.liveVersionId
    ctx.check((await page.$eval('select[name="cvVersionId"]', (select) => select.value)) === live, 'the live CV is chosen by default')
    await setTextarea(page, 'textarea[name="coverNote"]', 'x'.repeat(2001))
    await clickText(page, 'Send application', '[role="dialog"] button')
    await page.waitForSelector('[data-apply-dialog] [role="alert"]')
    const errors = await alerts(page)
    ctx.check(errors.some((text) => text.includes('at most 2000')) && errors.some((text) => text.includes('Tick the box')), `cover note and consent errors: ${JSON.stringify(errors)}`)
    await ctx.screenshot(page, '1-errors')

    await setTextarea(page, 'textarea[name="coverNote"]', 'I would love to help your team ship calm hiring tools.')
    await toggleCheckbox(page, 'consent')
    await clickText(page, 'Send application', '[role="dialog"] button')
    await page.waitForSelector('[data-applied]', { visible: true })
    await waitForText(page, 'Application sent')
    await page.waitForFunction((count) => document.querySelector('[data-nav-badge="applications"]')?.textContent === String(count), { timeout: 15_000 }, before + 1)
    ctx.check((await badge(page)) === String(before + 1), 'the sidebar badge counts the new application within 15 s')
    await handle.checkOverflow()
    await ctx.screenshot(page, '2-applied')

    await page.goto(`${ctx.webUrl}/candidate/applications`, { waitUntil: 'networkidle0' })
    const mine = (await pageApi(page, '/candidate/applications')).body.items.find((item) => item.job.id === job.id)
    ctx.check(mine?.status === 'applied', 'the application is stored as applied')
    await page.click(`[data-application="${mine.id}"]`)
    await page.waitForSelector('[data-history]', { visible: true })
    const steps = await page.$$eval('[data-step]', (items) => items.map((item) => [item.dataset.step, item.querySelector('time').textContent]))
    ctx.check(steps.length === 1 && steps[0][0] === 'applied' && steps[0][1].length > 0, `a dated "Applied" step: ${JSON.stringify(steps)}`)
    await handle.checkOverflow()
    await ctx.screenshot(page, '3-activity')
    ctx.assertClean(handle.issues, 'apply')
    if (ctx.viewport !== 'D') return

    // OD14: one email an hour after the first application.
    await tickIn(59 * MINUTE)
    ctx.check((await mailTo(recruiter.email, 'new_applications')).length === 0, 'no email before the hour')
    await tickIn(61 * MINUTE)
    const [first] = await mailTo(recruiter.email, 'new_applications')
    ctx.check(first?.subject === `1 new application for ${job.title}`, `"1 new application" (${first?.subject})`)

    // A second application right after that email waits until an hour after it.
    const second = await completeCandidate('SecondApplicant')
    ctx.check((await applyApi(second.token, job.id)).status === 201, 'a second candidate applies')
    await tickIn(100 * MINUTE)
    ctx.check((await mailTo(recruiter.email, 'new_applications')).length === 1, 'no second email within the hour after the first')
    await tickIn(122 * MINUTE)
    const mails = await mailTo(recruiter.email, 'new_applications')
    ctx.check(mails.length === 2 && /new application/.test(mails[1].subject), `the next email after the hour (${mails.map((mail) => mail.subject).join(' | ')})`)
    ctx.note(`emails: ${mails.map((mail) => mail.subject).join(' | ')}`)
  },
}
