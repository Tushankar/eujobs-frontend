import { fixture } from '../fixtures/make.js'
import { onboardedCandidate, uploadAs } from '../lib/candidates.js'
import { chooseFile, signInWithForm, waitForText } from '../lib/flows.js'
import { api, db, TEST_PASSWORD } from '../lib/testApi.js'

/**
 * A rejected external certificate shows the reason as a red notice and takes a new document on the Verification page,
 * which goes back in review. On Find jobs a Free candidate's "matching skills" panel shows the AI unlock.
 */
export default {
  name: 'ZZ Certificate resubmit',
  viewports: ['D', 'M'],
  async run(ctx) {
    const candidate = await onboardedCandidate(`Cert${ctx.viewport}`)
    const { token } = candidate
    const created = await api('/candidate/profile/certificates', { method: 'POST', token, body: { name: 'AWS Full End-to-End Cloud', issuer: 'Amazon', issuedOn: '2025-06' } })
    if (created.status !== 200) throw new Error(`certificate ${created.status}`)
    const certificate = created.body.certificates.at(-1)
    const file = await uploadAs(token, `/candidate/profile/certificates/${certificate.id}/file`, fixture('kyc-identity.pdf'), 'application/pdf')
    if (file.status !== 200) throw new Error(`file ${file.status}`)
    const review = await api('/candidate/verification/submissions', { method: 'POST', token, body: { category: 'certificate', entryId: certificate.id } })
    if (review.status !== 200) throw new Error(`review ${review.status}`)
    await db('verificationsubmissions', 'updateMany', { filter: { entryId: { $oid: certificate.id } }, update: { $set: { status: 'rejected', reason: 'not valid', reviewedAt: { $date: new Date().toISOString() } } } })

    const handle = await ctx.newPage()
    const { page } = handle
    await signInWithForm(page, ctx.webUrl, '/sign-in', candidate.email, TEST_PASSWORD)
    await page.goto(`${ctx.webUrl}/candidate/verification`, { waitUntil: 'networkidle0' })
    await waitForText(page, 'Not approved: not valid')
    const button = await page.waitForSelector(`[data-certificate-upload="${certificate.id}"]`, { visible: true })
    await button.evaluate((element) => element.closest('li').scrollIntoView({ block: 'center' }))
    await new Promise((resolve) => setTimeout(resolve, 400))
    await handle.checkOverflow()
    await ctx.screenshot(page, '1-rejected')

    await chooseFile(page, '[data-certificate-file]', fixture('kyc-registration.png'))
    await page.waitForFunction((id) => document.querySelector(`[data-certificate-upload="${id}"]`) === null, { timeout: 20_000 }, certificate.id)
    const row = await page.$eval('li[data-status="in_review"]', (element) => element.innerText).catch(() => '')
    ctx.check(row.includes('AWS Full End-to-End Cloud'), `the certificate is back in review (${row.replace(/\n/g, ' ').slice(0, 120)})`)
    const [latest] = await db('verificationsubmissions', 'find', { filter: { entryId: { $oid: certificate.id }, status: 'in_review' } })
    ctx.check(Boolean(latest), 'a new in-review submission exists')
    await ctx.screenshot(page, '2-resubmitted')

    await page.goto(`${ctx.webUrl}/candidate/jobs`, { waitUntil: 'networkidle0' })
    const why = await page.waitForSelector('[data-job] button[aria-expanded]', { visible: true })
    await why.click()
    const unlock = await page.waitForSelector('[data-job] [data-ai-unlock]', { visible: true })
    await unlock.evaluate((element) => element.closest('[data-job]').scrollIntoView({ block: 'center' }))
    await new Promise((resolve) => setTimeout(resolve, 300))
    await handle.checkOverflow()
    await ctx.screenshot(page, '3-ai-unlock')
    ctx.assertClean(handle.issues, 'certificate')
  },
}
