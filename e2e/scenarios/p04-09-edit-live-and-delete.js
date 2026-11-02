import { clickText, fill, signInWithForm, waitForPath, waitForText } from '../lib/flows.js'
import { approvedRecruiter, jobBody, login, postJob } from '../lib/recruiters.js'
import { api, TEST_PASSWORD } from '../lib/testApi.js'

/**
 * P4-09 (M-037, M-038): editing a published job's title shows the new title to candidates at once; Delete is offered
 * only on drafts.
 */
export default {
  name: 'P4-09 Edit live and delete',
  viewports: ['D'],
  async run(ctx) {
    const recruiter = await approvedRecruiter('Live')
    const token = await login(recruiter.email)
    const live = await postJob(token, jobBody({ title: 'Live title before' }))
    const draft = await postJob(token, jobBody({ title: 'Draft to delete' }), { draft: true })
    const handle = await ctx.newPage()
    const { page } = handle
    await signInWithForm(page, ctx.webUrl, '/recruiter/sign-in', recruiter.email, TEST_PASSWORD)

    await page.goto(`${ctx.webUrl}/recruiter/jobs/${live.id}/edit`, { waitUntil: 'networkidle0' })
    await fill(page, 'input[name="title"]', 'Live title after')
    await clickText(page, 'Publish', 'ol button')
    await clickText(page, 'Save changes', 'button')
    await waitForPath(page, `/recruiter/jobs/${live.id}`)
    await waitForText(page, 'Changes saved. Candidates see them straight away.')
    const emmaToken = await login(ctx.seedCredentials.email('emma'), 'candidate', ctx.seedCredentials.password)
    ctx.check((await api(`/jobs/${live.id}`, { token: emmaToken })).body.title === 'Live title after', 'candidates see the new title')
    await ctx.screenshot(page, '1-edited')

    await page.goto(`${ctx.webUrl}/recruiter/jobs`, { waitUntil: 'networkidle0' })
    await page.click('button[aria-label="Manage Live title after"]')
    await waitForText(page, 'Close job')
    ctx.check(!(await page.evaluate(() => document.body.innerText.includes('Delete draft'))), 'no Delete on a published job')
    await page.keyboard.press('Escape')
    await page.click('button[aria-label="Manage Draft to delete"]')
    await clickText(page, 'Delete draft', 'button')
    await clickText(page, 'Delete draft', '[role="dialog"] button')
    await page.waitForFunction(() => !document.body.innerText.includes('Draft to delete'))
    ctx.check((await api(`/recruiter/jobs/${draft.id}`, { token })).status === 404, 'the draft is deleted')
    await ctx.screenshot(page, '2-draft-deleted')
    ctx.assertClean(handle.issues, 'edit and delete')
  },
}
