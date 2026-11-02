import { clickText, fill, signInWithForm, waitForPath, waitForText } from '../lib/flows.js'
import { submittedRecruiter } from '../lib/recruiters.js'
import { api, mailTo, TEST_PASSWORD } from '../lib/testApi.js'

const REASON = 'The registration certificate is unreadable. Upload a clearer copy.'

/**
 * P4-04 (M-152, M-165): Reject needs a reason; the recruiter's status page shows it with Resubmit and the email
 * carries it. The recruiter edits the company, resubmits, and the account is pending again.
 */
export default {
  name: 'P4-04 Reject and resubmit',
  viewports: ['D'],
  async run(ctx) {
    const recruiter = await submittedRecruiter('Reject')
    const userId = (await api('/me', { token: recruiter.token })).body.id
    const owner = await ctx.newPage()
    await signInWithForm(owner.page, ctx.webUrl, '/admin/sign-in', ctx.seedCredentials.email(), ctx.seedCredentials.password)
    await owner.page.goto(`${ctx.webUrl}/admin/moderation/accounts/${userId}`, { waitUntil: 'networkidle0' })
    await clickText(owner.page, 'Reject', '[role="dialog"] button')
    await clickText(owner.page, 'Reject application', '[role="dialog"] button')
    await waitForText(owner.page, 'This field is required.')
    await fill(owner.page, 'textarea[name="reason"]', REASON)
    await ctx.screenshot(owner.page, '1-reject')
    await clickText(owner.page, 'Reject application', '[role="dialog"] button')
    await waitForText(owner.page, 'Decision saved and emailed to the recruiter.')
    ctx.check((await mailTo(recruiter.email, 'recruiter_rejected')).at(-1)?.params.reason === REASON, 'the rejection email carries the reason')
    ctx.assertClean(owner.issues, 'reject')

    const handle = await ctx.newPage()
    const { page } = handle
    await signInWithForm(page, ctx.webUrl, '/recruiter/sign-in', recruiter.email, TEST_PASSWORD)
    await waitForPath(page, '/recruiter/onboarding/review')
    await waitForText(page, REASON)
    await waitForText(page, 'Resubmit for review')
    await ctx.screenshot(page, '2-rejected')

    await clickText(page, 'Edit details', 'a')
    await waitForPath(page, '/recruiter/onboarding/company')
    await fill(page, 'input[name="industry"]', 'Product design studio')
    await clickText(page, 'Continue', 'button[type="submit"]')
    await waitForPath(page, '/recruiter/onboarding/kyc')
    await page.goto(`${ctx.webUrl}/recruiter/onboarding/review`, { waitUntil: 'networkidle0' })
    await clickText(page, 'Resubmit for review', 'button')
    await waitForText(page, 'Under review')
    await ctx.screenshot(page, '3-pending-again')
    const state = (await api('/recruiter/onboarding', { token: recruiter.token })).body
    ctx.check(state.status === 'pending_review' && state.company.industry === 'Product design studio', 'pending again with the edited company')
    ctx.assertClean(handle.issues, 'resubmit')
  },
}
