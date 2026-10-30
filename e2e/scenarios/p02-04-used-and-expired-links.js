import { bodyText } from '../lib/flows.js'
import { api, date, db, linkToken, TEST_PASSWORD, uniqueEmail } from '../lib/testApi.js'

const register = (email) =>
  api('/auth/candidate/register', {
    method: 'POST',
    body: { fullName: 'Link Tester', email, password: TEST_PASSWORD, acceptTerms: true, language: 'en', country: 'DE' },
  })

/** P2-04: a used link says so with Sign in; an expired one (date shifted) offers an email field and Resend. */
export default {
  name: 'P2-04 Used and expired links',
  viewports: ['D'],
  async run(ctx) {
    const handle = await ctx.newPage()
    const { page } = handle
    handle.allow(409, '/api/v1/auth/verify-email')
    handle.allow(410, '/api/v1/auth/verify-email')

    const usedEmail = uniqueEmail('p204used')
    await register(usedEmail)
    const usedLink = (await linkToken(usedEmail, 'verify_email')).href
    await page.goto(usedLink, { waitUntil: 'networkidle0' })
    await page.waitForFunction(() => document.body.innerText.includes('Email verified.'))
    await page.goto(usedLink, { waitUntil: 'networkidle0' })
    await page.waitForFunction(() => document.body.innerText.includes('This link was already used.'))
    ctx.check(await page.$('a[href="/sign-in"]'), 'the used state links to sign-in')
    await ctx.screenshot(page, '1-used')

    const expiredEmail = uniqueEmail('p204expired')
    await register(expiredEmail)
    const [user] = await db('users', 'find', { filter: { email: expiredEmail } })
    await db('emailtokens', 'updateMany', { filter: { userId: user._id }, update: { $set: { expiresAt: date(Date.now() - 60_000) } } })
    await page.goto((await linkToken(expiredEmail, 'verify_email')).href, { waitUntil: 'networkidle0' })
    await page.waitForFunction(() => document.body.innerText.includes('This link has expired.'))
    ctx.check(await page.$('input[name="email"]'), 'the expired state has an email field')
    ctx.check((await bodyText(page)).includes('Resend the link'), 'the expired state offers Resend')
    await ctx.screenshot(page, '2-expired')
    ctx.assertClean(handle.issues, 'verify-email page')
  },
}
