import { clickText, fill, pageApi, signInWithForm, waitForText } from '../lib/flows.js'
import { api, db, mailTo } from '../lib/testApi.js'

/**
 * P4-13 (M-026, M-029, M-168, M-187, U19, P4-D12): Sarah's view of Emma shows the photo, links, the three ticks,
 * languages, right to work, history and education. Emma's CV is private, so Sarah requests an earlier version: the
 * cv_request email is captured and the request waits on Emma's CV page; Emma shares version 1; Sarah opens it; Emma's
 * download log shows it; the timeline shows request, decision and download.
 */
export default {
  name: 'P4-13 Candidate profile and CV request',
  viewports: ['D'],
  async run(ctx) {
    const emmaEmail = ctx.seedCredentials.email('emma')
    const [emma] = await db('users', 'find', { filter: { email: emmaEmail } })
    const base = `/recruiter/find-candidates/${emma._id.$oid}`
    const sarah = await ctx.newPage()
    const { page } = sarah
    await signInWithForm(page, ctx.webUrl, '/recruiter/sign-in', ctx.seedCredentials.email('sarah'), ctx.seedCredentials.password)

    await page.goto(`${ctx.webUrl}${base}`, { waitUntil: 'networkidle0' })
    await waitForText(page, 'Emma Wilson')
    await page.waitForSelector('#candidate-name')
    ctx.check(await page.$('section img'), 'the photo shows')
    for (const check of ['identity', 'academic', 'employment']) ctx.check(await page.$(`[data-check="${check}"]`), `the ${check} tick shows`)
    await waitForText(page, 'Portfolio')
    await waitForText(page, 'Citizen or settled status')
    await ctx.screenshot(page, '1-overview')
    for (const [tab, text] of [
      ['experience', 'Notion'],
      ['skills', 'Native'],
      ['education', 'University of the Arts London'],
    ]) {
      await page.goto(`${ctx.webUrl}${base}/${tab}`, { waitUntil: 'networkidle0' })
      await waitForText(page, text)
    }

    await page.goto(`${ctx.webUrl}${base}/resume`, { waitUntil: 'networkidle0' })
    await waitForText(page, 'keeps their CV private')
    await clickText(page, 'Request earlier version', 'button')
    await page.select('select[name="reason"]', 'verify_employment')
    await fill(page, 'textarea[name="details"]', 'To confirm the 2019 to 2022 role.')
    await clickText(page, 'Send request', 'button')
    await waitForText(page, 'Request sent. The candidate has been emailed.')
    await ctx.screenshot(page, '2-requested')
    const mail = (await mailTo(emmaEmail, 'cv_request')).at(-1)
    ctx.check(mail?.params.company === 'Acme Studio' && mail.params.reason === 'Verify employment history', 'the cv_request email is captured')

    const emmaPage = await ctx.newPage()
    await signInWithForm(emmaPage.page, ctx.webUrl, '/sign-in', emmaEmail, ctx.seedCredentials.password)
    await emmaPage.page.goto(`${ctx.webUrl}/candidate/cv-versions`, { waitUntil: 'networkidle0' })
    await waitForText(emmaPage.page, 'Acme Studio · Verify employment history')
    const requestId = (await pageApi(emmaPage.page, '/candidate/cv/requests')).body.items[0].id
    const versionId = (await pageApi(emmaPage.page, '/candidate/cv')).body.items.find((version) => version.number === 1).id
    await emmaPage.page.select(`select[name="share-${requestId}"]`, versionId)
    await clickText(emmaPage.page, 'Share this version', 'button')
    await waitForText(emmaPage.page, 'Shared version 1')
    await ctx.screenshot(emmaPage.page, '3-shared')

    await page.reload({ waitUntil: 'networkidle0' })
    await waitForText(page, 'Versions shared with you')
    const cv = (await pageApi(page, `/recruiter/candidates/${emma._id.$oid}/cv`)).body
    const opened = await page.evaluate(async (url) => (await fetch(url)).status, cv.shared[0].url)
    ctx.check(opened === 200, `the shared version opens (got ${opened})`)
    await ctx.screenshot(page, '4-resume-tab')

    await emmaPage.page.reload({ waitUntil: 'networkidle0' })
    await waitForText(emmaPage.page, 'Acme Studio opened version 1')
    ctx.assertClean(emmaPage.issues, 'candidate CV page')

    await page.goto(`${ctx.webUrl}${base}/activity`, { waitUntil: 'networkidle0' })
    for (const type of ['cv_request', 'cv_request_decided', 'cv_download']) await page.waitForSelector(`[data-activity="${type}"]`)
    await ctx.screenshot(page, '5-activity')
    ctx.assertClean(sarah.issues, 'recruiter profile')
    ctx.check((await api(`/recruiter/candidates/${emma._id.$oid}/cv`, { token: null })).status === 401, 'the CV API needs a session')
  },
}
