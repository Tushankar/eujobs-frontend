import { fixture } from '../fixtures/make.js'
import { invitedAdmin, openAsAdmin, roleWith } from '../lib/admins.js'
import { uploadAs } from '../lib/candidates.js'
import { responseTo } from '../lib/flows.js'
import { bellCount, clickNotification, countersOf, openBell, rowsOf, waitForBell, waitForSection } from '../lib/notifications.js'
import { freeCandidate, meOf } from '../lib/payments.js'
import { mailTo } from '../lib/testApi.js'

const switchState = (page) => page.$$eval('[data-email-switches] [role="switch"]', (items) => items.map((item) => item.getAttribute('aria-checked')))

/**
 * P11b-03 (P11b-Q1 … Q4, Q10, Q12): a candidate submits identity evidence. An admin holding moderation.manage gets
 * (with documents.view, which the review dialog needs for the file) the bell and Moderation counts and the email at once; the notification opens that verification item and clears the
 * counts. An admin with only finance.view gets neither notification nor email. Admin Settings saves the Verification
 * email switch.
 */
export default {
  name: 'P11b-03 Admin notifications',
  viewports: ['D', 'M'],
  async run(ctx) {
    const moderator = await invitedAdmin(`Moderator${ctx.viewport}`, (await roleWith(`Moderation ${ctx.viewport}`, ['moderation.manage', 'documents.view'])).id)
    const finance = await invitedAdmin(`Finance${ctx.viewport}`, (await roleWith(`Finance ${ctx.viewport}`, ['finance.view'])).id)
    const candidate = await freeCandidate(`Evidence${ctx.viewport}`, 'GB')

    const handle = await ctx.newPage()
    const { page } = handle
    await openAsAdmin(ctx, handle, moderator.email, '/admin/moderation')
    ctx.check((await bellCount(page)) === 0, 'no notification before the event')

    const submitted = await uploadAs(candidate.token, '/candidate/verification/submissions', fixture('passport.jpg'), 'image/jpeg', { category: 'identity', evidenceType: 'passport' })
    ctx.check(submitted.status < 300, `evidence submitted (${submitted.status})`)
    await waitForBell(page, 1)
    await waitForSection(page, 'moderation', 1)
    await openBell(page)
    const [row] = await rowsOf(page)
    ctx.check(row.type === 'admin_verification_submitted' && row.text.includes(`${candidate.user.fullName} submitted evidence for review: Identity`), `row ${JSON.stringify(row)}`)
    await handle.checkOverflow()
    await ctx.screenshot(page, '1-dropdown')

    const answer = await clickNotification(page, 'admin_verification_submitted', '/admin/moderation/verification/')
    await page.waitForSelector('[role="dialog"]', { visible: true })
    ctx.check(page.url().endsWith(answer.path), `opened ${answer.path}`)
    await waitForBell(page, 0)
    await waitForSection(page, 'moderation', 0)
    await ctx.screenshot(page, '2-verification-opened')

    ctx.check((await mailTo(moderator.email, 'admin_verification_submitted')).length === 1, 'the moderator got the email at once')
    ctx.check((await mailTo(finance.email, 'admin_verification_submitted')).length === 0, 'the finance admin got no email')
    ctx.check((await countersOf(finance.token)).unread === 0, 'the finance admin has no notification')
    const other = await ctx.newPage()
    await openAsAdmin(ctx, other, finance.email, '/admin/payments')
    ctx.check((await bellCount(other.page)) === 0, 'the finance admin’s bell shows nothing')
    ctx.assertClean(other.issues, 'finance admin')

    await page.goto(`${ctx.webUrl}/admin/settings`, { waitUntil: 'networkidle0' })
    ctx.check(JSON.stringify(await switchState(page)) === '["true","true","true","true","true"]', 'five categories, all on')
    const saved = responseTo(page, '/api/v1/me/notifications', 'PATCH')
    await page.click('[data-email-switches] li:nth-child(2) [role="switch"]')
    await saved
    await page.reload({ waitUntil: 'networkidle0' })
    ctx.check(JSON.stringify(await switchState(page)) === '["true","false","true","true","true"]', 'Verification stays off after a reload')
    ctx.check((await meOf(moderator.token)).emailSwitches.verification === false, 'saved on the account')
    await page.$eval('[data-card="notifications"]', (card) => card.scrollIntoView({ block: 'center' }))
    await handle.checkOverflow()
    await ctx.screenshot(page, '3-settings')
    ctx.assertClean(handle.issues, 'admin notifications')
  },
}
