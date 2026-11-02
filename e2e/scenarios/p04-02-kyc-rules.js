import { fixture } from '../fixtures/make.js'
import { signInWithForm, waitForPath, waitForText } from '../lib/flows.js'
import { uploadAs } from '../lib/candidates.js'
import { registeredRecruiter, saveCompany } from '../lib/recruiters.js'
import { api, TEST_PASSWORD } from '../lib/testApi.js'

/**
 * P4-02 (M-185): on the KYC step an 11 MB PDF and a .txt file are refused with translated messages. After submit
 * the step is read-only (no file inputs) and the API refuses a replacement with LOCKED.
 */
export default {
  name: 'P4-02 KYC rules',
  viewports: ['D'],
  async run(ctx) {
    const recruiter = await registeredRecruiter('Kyc')
    await saveCompany(recruiter.token)
    const handle = await ctx.newPage()
    const { page } = handle
    await signInWithForm(page, ctx.webUrl, '/recruiter/sign-in', recruiter.email, TEST_PASSWORD)
    await waitForPath(page, '/recruiter/onboarding/kyc')

    await (await page.$$('input[type="file"]'))[0].uploadFile(fixture('cv-11mb.pdf'))
    await waitForText(page, 'cv-11mb.pdf is larger than 10 MB')
    await (await page.$$('input[type="file"]'))[1].uploadFile(fixture('notes.txt'))
    await waitForText(page, 'notes.txt is not a PDF, JPG or PNG file')
    await ctx.screenshot(page, '1-refused')

    const upload = (type, file, mime) => uploadAs(recruiter.token, '/recruiter/onboarding/documents', fixture(file), mime, { type })
    await upload('identity', 'kyc-identity.pdf', 'application/pdf')
    await upload('registration', 'kyc-registration.png', 'image/png')
    const { code } = (await api('/recruiter/onboarding/phone/code', { method: 'POST', token: recruiter.token, body: { phone: '+44 20 7946 0999' } })).body
    await api('/recruiter/onboarding/phone/confirm', { method: 'POST', token: recruiter.token, body: { code } })
    await api('/recruiter/onboarding/submit', { method: 'POST', token: recruiter.token })

    // Submitted: the review page is the only step left, and the documents are locked.
    await page.goto(`${ctx.webUrl}/recruiter/onboarding/kyc`, { waitUntil: 'networkidle0' })
    await waitForPath(page, '/recruiter/onboarding/review')
    const replaced = await upload('authorization', 'kyc-identity.pdf', 'application/pdf')
    ctx.check(replaced.status === 409 && replaced.body.error.code === 'LOCKED', `a replacement after submit is LOCKED (got ${replaced.status})`)
    const state = (await api('/recruiter/onboarding', { token: recruiter.token })).body
    ctx.check(state.editable === false && state.documents.length === 2, 'the application is no longer editable')
    await ctx.screenshot(page, '2-locked')
    ctx.assertClean(handle.issues, 'kyc')
  },
}
