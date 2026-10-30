import { fixture } from '../fixtures/make.js'
import { chooseFile, clickText, signInWithForm, toggleCheckbox, waitForText } from '../lib/flows.js'
import { onboardedCandidate } from '../lib/candidates.js'
import { db, mailTo, TEST_PASSWORD } from '../lib/testApi.js'

/** Submits a passport JPG for the identity check from the Verification page. */
async function submitPassport(page) {
  await page.click('button[aria-label="Submit evidence for Identity"]')
  await page.waitForSelector('select[name="evidenceType"]')
  await page.select('select[name="evidenceType"]', 'passport')
  await chooseFile(page, '#evidence-file', fixture('passport.jpg'))
  await toggleCheckbox(page, 'confirmed')
  await clickText(page, 'Submit for review', '[role="dialog"] button')
  await page.waitForFunction(() => !document.querySelector('[role="dialog"]'))
}

/** Opens the newest in-review submission of `name` in the admin queue and returns the dialog text. */
async function openReview(page, webUrl, name) {
  await page.goto(`${webUrl}/admin/moderation/verification`, { waitUntil: 'networkidle0' })
  const link = await page.waitForFunction(
    (person) => [...document.querySelectorAll('li')].find((row) => row.innerText.includes(person))?.querySelector('a'),
    { timeout: 15_000 },
    name,
  )
  await link.asElement().click()
  await page.waitForSelector('[role="dialog"] [data-claim]')
  await page.waitForNetworkIdle()
  return page.$eval('[role="dialog"]', (dialog) => dialog.innerText)
}

// The identity check is the first row of the checks list.
const identityStatus = (page) => page.$eval('li[data-status]', (row) => row.dataset.status)

/**
 * P3-07 (M-166, M-092, M-162, U39): identity evidence goes in review; the Owner sees the preview, the candidate
 * and the claim; a rejection with a reason reaches the candidate (page and email in their language); a
 * resubmission is approved; the identity item is ticked and the approval email is sent.
 */
export default {
  name: 'P3-07 Evidence flow',
  viewports: ['D', 'M'],
  async run(ctx) {
    const { email, user } = await onboardedCandidate('Evidence')
    const name = user.fullName
    const candidate = await ctx.newPage()
    await signInWithForm(candidate.page, ctx.webUrl, '/sign-in', email, TEST_PASSWORD)
    await candidate.page.goto(`${ctx.webUrl}/candidate/verification`, { waitUntil: 'networkidle0' })
    await submitPassport(candidate.page)
    await candidate.page.waitForFunction(() => document.querySelector('li[data-status]').dataset.status === 'in_review')
    await ctx.screenshot(candidate.page, '1-in-review')

    const owner = await ctx.newPage()
    await signInWithForm(owner.page, ctx.webUrl, '/admin/sign-in', ctx.seedCredentials.email(null), ctx.seedCredentials.password)
    const details = await openReview(owner.page, ctx.webUrl, name)
    ctx.check(details.includes(`Account name: ${name}`), 'the claim is the account name')
    ctx.check(Boolean(await owner.page.$('[role="dialog"] img[alt^="Evidence file"]')), 'the evidence image is previewed')
    await owner.checkOverflow()
    await ctx.screenshot(owner.page, '2-review')

    // M-092: the email goes out in the candidate's language (Spanish here), then the language is restored.
    await db('users', 'updateMany', { filter: { email }, update: { $set: { language: 'es' } } })
    try {
      await clickText(owner.page, 'Reject', '[role="dialog"] button')
      await owner.page.type('textarea[name="reason"]', 'The photo page is not readable.')
      await clickText(owner.page, 'Reject evidence', '[role="dialog"] button')
      await owner.page.waitForFunction(() => !document.querySelector('[role="dialog"]'))
    } finally {
      await db('users', 'updateMany', { filter: { email }, update: { $set: { language: 'en' } } })
    }
    const [rejected] = await mailTo(email, 'verification_rejected')
    ctx.check(rejected?.language === 'es' && rejected.subject === 'Tu verificación de identidad necesita nueva documentación', `the rejection email is in Spanish (${rejected?.subject})`)
    ctx.check(rejected.text.includes('The photo page is not readable.'), 'the email carries the reason')

    await candidate.page.reload({ waitUntil: 'networkidle0' })
    ctx.check((await identityStatus(candidate.page)) === 'rejected', 'the candidate sees Rejected')
    await waitForText(candidate.page, 'Not approved: The photo page is not readable.')
    await ctx.screenshot(candidate.page, '3-rejected')
    await submitPassport(candidate.page)
    await candidate.page.waitForFunction(() => document.querySelector('li[data-status]').dataset.status === 'in_review')

    const again = await openReview(owner.page, ctx.webUrl, name)
    // innerText follows the eyebrow's text-transform, so the heading is compared case-insensitively.
    ctx.check(again.toLowerCase().includes('earlier submissions') && again.includes('The photo page is not readable.'), 'the earlier rejection is listed')
    await clickText(owner.page, 'Approve', '[role="dialog"] button')
    await clickText(owner.page, 'Approve evidence', '[role="dialog"] button')
    await owner.page.waitForFunction(() => !document.querySelector('[role="dialog"]'))
    ctx.check((await mailTo(email, 'verification_approved')).length === 1, 'the approval email is sent')

    await candidate.page.reload({ waitUntil: 'networkidle0' })
    ctx.check((await identityStatus(candidate.page)) === 'approved', 'identity is approved')
    ctx.check(Boolean(await candidate.page.$('li[data-status="approved"] [role="img"]')), 'identity shows a tick')
    await candidate.page.goto(`${ctx.webUrl}/candidate/profile`, { waitUntil: 'networkidle0' })
    ctx.check(await candidate.page.$eval('[data-item="check_identity"]', (item) => item.dataset.done === 'true'), 'the checklist item is done')
    await candidate.checkOverflow()
    await ctx.screenshot(candidate.page, '4-approved')
    ctx.assertClean(candidate.issues, 'candidate')
    ctx.assertClean(owner.issues, 'owner')
  },
}
