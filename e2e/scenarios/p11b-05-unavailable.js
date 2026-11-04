import { fixture } from '../fixtures/make.js'
import { recruiterWithJob } from '../lib/applicants.js'
import { invitedAdmin, openAsAdmin, roleWith } from '../lib/admins.js'
import { uploadAs } from '../lib/candidates.js'
import { signInWithForm, waitForText } from '../lib/flows.js'
import { openBell, waitForBell } from '../lib/notifications.js'
import { freeCandidate, openAs } from '../lib/payments.js'
import { db, TEST_PASSWORD } from '../lib/testApi.js'

const MISSING = 'aaaaaaaaaaaaaaaaaaaaaaaa'
const UNAVAILABLE = 'This item is no longer available.'

/**
 * P11b-05 (P11b-Q4): an item that is gone shows "no longer available", never a crash or the 403 page. A moderator's
 * verification notification whose submission was deleted stays on the page with the message and is marked read.
 * Direct links to a missing application (candidate and recruiter) and a missing payment (Owner) say the same.
 */
export default {
  name: 'P11b-05 No longer available',
  viewports: ['D', 'M'],
  async run(ctx) {
    const moderator = await invitedAdmin(`Gone${ctx.viewport}`, (await roleWith(`Gone ${ctx.viewport}`, ['moderation.manage', 'documents.view'])).id)
    const candidate = await freeCandidate(`GoneCandidate${ctx.viewport}`, 'GB')
    await uploadAs(candidate.token, '/candidate/verification/submissions', fixture('passport.jpg'), 'image/jpeg', { category: 'identity', evidenceType: 'passport' })
    await db('verificationsubmissions', 'deleteMany', { filter: { userId: { $oid: candidate.user.id } } })

    const admin = await ctx.newPage()
    const { page } = admin
    await openAsAdmin(ctx, admin, moderator.email, '/admin/moderation')
    await waitForBell(page, 1)
    await openBell(page)
    const before = page.url()
    await page.click('[data-notifications-panel] [data-notification="admin_verification_submitted"]')
    await page.waitForFunction((text) => document.querySelector('[data-notifications-panel]')?.innerText.includes(text), {}, UNAVAILABLE)
    ctx.check(page.url() === before, 'stays on the page')
    await waitForBell(page, 0)
    await admin.checkOverflow()
    await ctx.screenshot(page, '1-dropdown-unavailable')
    ctx.assertClean(admin.issues, 'moderator')

    const ownerPage = await ctx.newPage()
    ownerPage.allow(404, `/api/v1/admin/payments/${MISSING}`)
    await signInWithForm(ownerPage.page, ctx.webUrl, '/admin/sign-in', ctx.seedCredentials.email(), ctx.seedCredentials.password)
    await ownerPage.page.goto(`${ctx.webUrl}/admin/payments/${MISSING}`, { waitUntil: 'networkidle0' })
    await waitForText(ownerPage.page, UNAVAILABLE)
    ctx.check(await ownerPage.page.$('[role="dialog"]'), 'the payment dialog says it, over the list')
    await ctx.screenshot(ownerPage.page, '2-payment-unavailable')
    ctx.assertClean(ownerPage.issues, 'owner payments')

    const candidatePage = await ctx.newPage()
    await openAs(ctx, candidatePage, candidate.email, `/candidate/applications/${MISSING}`)
    await waitForText(candidatePage.page, UNAVAILABLE)
    await candidatePage.checkOverflow()
    await ctx.screenshot(candidatePage.page, '3-candidate-application-unavailable')
    ctx.assertClean(candidatePage.issues, 'candidate applications')

    const { recruiter } = await recruiterWithJob(`GoneRec${ctx.viewport}`)
    const recruiterPage = await ctx.newPage()
    recruiterPage.allow(404, `/api/v1/recruiter/applications/${MISSING}`)
    await signInWithForm(recruiterPage.page, ctx.webUrl, '/recruiter/sign-in', recruiter.email, TEST_PASSWORD)
    await recruiterPage.page.goto(`${ctx.webUrl}/recruiter/applications/${MISSING}`, { waitUntil: 'networkidle0' })
    await waitForText(recruiterPage.page, UNAVAILABLE)
    await recruiterPage.checkOverflow()
    await ctx.screenshot(recruiterPage.page, '4-recruiter-application-unavailable')
    ctx.assertClean(recruiterPage.issues, 'recruiter applications')
  },
}
