import { signInWithForm, waitForText } from '../lib/flows.js'
import { approvedRecruiter, login } from '../lib/recruiters.js'
import { api, db, TEST_PASSWORD } from '../lib/testApi.js'

/** P4-15 (M-184): a recruiter who opens the same candidate twice in a day adds one profile view. */
export default {
  name: 'P4-15 Profile views',
  viewports: ['D'],
  async run(ctx) {
    const emmaEmail = ctx.seedCredentials.email('emma')
    const emmaToken = await login(emmaEmail, 'candidate', ctx.seedCredentials.password)
    const views = async () => (await api('/candidate/overview', { token: emmaToken })).body.profileViews.last30
    const before = await views()
    const [emma] = await db('users', 'find', { filter: { email: emmaEmail } })

    const recruiter = await approvedRecruiter('Viewer')
    const handle = await ctx.newPage()
    const { page } = handle
    await signInWithForm(page, ctx.webUrl, '/recruiter/sign-in', recruiter.email, TEST_PASSWORD)
    for (let visit = 0; visit < 2; visit++) {
      await page.goto(`${ctx.webUrl}/recruiter/find-candidates/${emma._id.$oid}`, { waitUntil: 'networkidle0' })
      await waitForText(page, 'Emma Wilson')
    }
    ctx.check((await views()) === before + 1, `two visits count once (before ${before}, after ${await views()})`)

    const emmaPage = await ctx.newPage()
    await signInWithForm(emmaPage.page, ctx.webUrl, '/sign-in', emmaEmail, ctx.seedCredentials.password)
    await emmaPage.page.waitForFunction((count) => document.querySelector('[data-stat="views"]')?.innerText.includes(String(count)), {}, before + 1)
    await ctx.screenshot(emmaPage.page, '1-candidate-overview')
    ctx.assertClean(handle.issues, 'recruiter')
    ctx.assertClean(emmaPage.issues, 'candidate overview')
  },
}
