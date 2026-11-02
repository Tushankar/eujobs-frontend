import { clickText, signInWithForm, waitForPath, waitForText } from '../lib/flows.js'
import { submittedRecruiter } from '../lib/recruiters.js'
import { api, db, mailTo, TEST_PASSWORD } from '../lib/testApi.js'

/**
 * P4-03 (M-165, §3.12): the Owner's Account review lists the applicant with the company, "Phone confirmed on screen
 * (no SMS)" and the KYC previews; Approve sends the approved email, the recruiter signs in to the workspace, and the
 * six default stages exist.
 */
export default {
  name: 'P4-03 Approve',
  viewports: ['D', 'M'],
  async run(ctx) {
    const recruiter = await submittedRecruiter('Approve')
    const owner = await ctx.newPage()
    const { page } = owner
    await signInWithForm(page, ctx.webUrl, '/admin/sign-in', ctx.seedCredentials.email(), ctx.seedCredentials.password)
    await page.goto(`${ctx.webUrl}/admin/moderation/accounts`, { waitUntil: 'networkidle0' })
    await waitForText(page, recruiter.fullName)
    await owner.checkOverflow()
    await ctx.screenshot(page, '1-queue')

    const row = await page.waitForFunction((name) => [...document.querySelectorAll('li')].find((item) => item.textContent.includes(name)), {}, recruiter.fullName)
    await (await row.asElement().$('a')).click()
    await waitForText(page, 'Phone confirmed on screen (no SMS)')
    await waitForText(page, recruiter.company.legalName)
    await page.waitForFunction(() => [...document.querySelectorAll('[role="dialog"] a')].some((link) => link.textContent.includes('kyc-identity.pdf')))
    await page.waitForSelector('[role="dialog"] img')
    await owner.checkOverflow()
    await ctx.screenshot(page, '2-review')
    await clickText(page, 'Approve', '[role="dialog"] button')
    await clickText(page, 'Approve account', '[role="dialog"] button')
    await waitForText(page, 'Decision saved and emailed to the recruiter.')
    ctx.check((await mailTo(recruiter.email, 'recruiter_approved')).length === 1, 'the approved email is captured')
    ctx.assertClean(owner.issues, 'admin review')

    const recruiterPage = await ctx.newPage()
    await signInWithForm(recruiterPage.page, ctx.webUrl, '/recruiter/sign-in', recruiter.email, TEST_PASSWORD)
    await waitForPath(recruiterPage.page, () => location.pathname === '/recruiter')
    await waitForText(recruiterPage.page, 'Open positions')
    await ctx.screenshot(recruiterPage.page, '3-workspace')
    const me = (await api('/me', { token: recruiter.token })).body
    const stages = await db('pipelinestages', 'count', { filter: { companyId: { $oid: me.company.id } } })
    ctx.check(stages === 6, `the six default stages exist (got ${stages})`)
    ctx.assertClean(recruiterPage.issues, 'recruiter workspace')
  },
}
