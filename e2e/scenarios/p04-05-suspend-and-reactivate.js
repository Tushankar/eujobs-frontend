import { clickText, fill, pageApi, signInWithForm, waitForPath, waitForText } from '../lib/flows.js'
import { login } from '../lib/recruiters.js'
import { api, db, mailTo } from '../lib/testApi.js'

const REASON = 'Several reports of misleading job offers are under review.'

/**
 * P4-05 (M-165, OQ-2, M-044, P4-Q2): the Owner suspends Sarah from the Active filter. Her open session gets 401,
 * signing in shows the blocked page with the reason, her jobs leave candidate Find jobs and the email is captured.
 * Approve in the Suspended filter reactivates her: active again, jobs back, approved email.
 */
export default {
  name: 'P4-05 Suspend and reactivate',
  viewports: ['D'],
  async run(ctx) {
    const sarahEmail = ctx.seedCredentials.email('sarah')
    const emmaToken = await login(ctx.seedCredentials.email('emma'), 'candidate', ctx.seedCredentials.password)
    const [acme] = await db('companies', 'find', { filter: { displayName: 'Acme Studio' } })
    const acmeJobs = async () => (await api('/jobs', { token: emmaToken })).body.items.filter((job) => job.company.id === acme._id.$oid).length
    ctx.check((await acmeJobs()) > 0, 'Emma sees Acme jobs before')

    const sarah = await ctx.newPage()
    sarah.allow(401, '/api/v1/me')
    await signInWithForm(sarah.page, ctx.webUrl, '/recruiter/sign-in', sarahEmail, ctx.seedCredentials.password)

    const owner = await ctx.newPage()
    const { page } = owner
    await signInWithForm(page, ctx.webUrl, '/admin/sign-in', ctx.seedCredentials.email(), ctx.seedCredentials.password)
    await page.goto(`${ctx.webUrl}/admin/moderation/accounts`, { waitUntil: 'networkidle0' })
    await clickText(page, 'Active', 'button')
    await waitForText(page, 'Sarah Miller')
    const row = await page.waitForFunction(() => [...document.querySelectorAll('li')].find((item) => item.textContent.includes('Sarah Miller')))
    await (await row.asElement().$('a')).click()
    await clickText(page, 'Suspend', '[role="dialog"] button')
    await fill(page, 'textarea[name="reason"]', REASON)
    await clickText(page, 'Suspend account', '[role="dialog"] button')
    await waitForText(page, 'Decision saved and emailed to the recruiter.')
    await ctx.screenshot(page, '1-suspended')

    ctx.check((await pageApi(sarah.page, '/me')).status === 401, "Sarah's session gets 401")
    ctx.check((await mailTo(sarahEmail, 'recruiter_suspended')).length === 1, 'the suspension email is captured')
    ctx.check((await acmeJobs()) === 0, 'her jobs vanish from candidate Find jobs')
    const again = await ctx.newPage()
    await signInWithForm(again.page, ctx.webUrl, '/recruiter/sign-in', sarahEmail, ctx.seedCredentials.password)
    await waitForPath(again.page, '/recruiter/onboarding/review')
    await waitForText(again.page, 'Your account is suspended')
    await waitForText(again.page, REASON)
    await ctx.screenshot(again.page, '2-blocked')
    ctx.assertClean(again.issues, 'blocked page')

    await page.goto(`${ctx.webUrl}/admin/moderation/accounts`, { waitUntil: 'networkidle0' })
    await clickText(page, 'Suspended', 'button')
    await waitForText(page, 'Sarah Miller')
    const suspendedRow = await page.waitForFunction(() => [...document.querySelectorAll('li')].find((item) => item.textContent.includes('Sarah Miller')))
    await (await suspendedRow.asElement().$('a')).click()
    await clickText(page, 'Reactivate', '[role="dialog"] button')
    await clickText(page, 'Reactivate account', '[role="dialog"] button')
    await waitForText(page, 'Decision saved and emailed to the recruiter.')
    ctx.assertClean(owner.issues, 'account review')

    const [user] = await db('users', 'find', { filter: { email: sarahEmail } })
    ctx.check(user.status === 'active', `Sarah is active again (got ${user.status})`)
    ctx.check((await acmeJobs()) > 0, 'her jobs are visible again')
    ctx.check((await mailTo(sarahEmail, 'recruiter_approved')).length === 1, 'the approved email is captured')
  },
}
