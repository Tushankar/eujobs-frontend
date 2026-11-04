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
    // The first KYC file opens in the viewer; picking the registration row shows the image.
    await page.waitForSelector('[role="dialog"] [data-document-viewer] [title="kyc-identity.pdf"]')
    await page.waitForSelector('[role="dialog"] [data-document-viewer] iframe')
    await clickText(page, 'Registration certificate', '[role="dialog"] button')
    await page.waitForSelector('[role="dialog"] [data-document-viewer] img')
    if (ctx.viewport === 'D') {
      // The document stays pinned and wholly visible while the details column scrolls.
      const pinned = await page.evaluate(() => {
        const viewer = document.querySelector('[role="dialog"] [data-document-viewer]')
        let body = viewer.parentElement
        while (getComputedStyle(body).overflowY !== 'auto') body = body.parentElement
        const before = viewer.getBoundingClientRect().top
        body.scrollTop = body.scrollHeight
        const after = viewer.getBoundingClientRect()
        const frame = body.getBoundingClientRect()
        const scrolled = body.scrollTop > 0
        body.scrollTop = 0
        return { scrolled, moved: Math.abs(after.top - before), inside: after.top >= frame.top && after.bottom <= frame.bottom }
      })
      ctx.check(pinned.scrolled && pinned.moved < 1 && pinned.inside, `the document stays pinned in view (${JSON.stringify(pinned)})`)
    }
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
