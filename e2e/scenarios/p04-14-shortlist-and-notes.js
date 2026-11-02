import { signInWithForm, waitForText } from '../lib/flows.js'
import { db } from '../lib/testApi.js'

/** Sets a textarea's value the way typing would (5,001 characters is too slow to type). */
const setTextarea = (page, selector, value) =>
  page.$eval(
    selector,
    (element, next) => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(element, next)
      element.dispatchEvent(new Event('input', { bubbles: true }))
    },
    value,
  )

/**
 * P4-14 (M-079, M-080): the bookmark adds Sofia to the company shortlist; once she turns discovery off she is hidden
 * with "1 … no longer available". A note of 5,001 characters is refused; a saved note shows who and when.
 */
export default {
  name: 'P4-14 Shortlist and notes',
  viewports: ['D'],
  async run(ctx) {
    const [sofia] = await db('users', 'find', { filter: { email: 'sofia.martinez@example.com' } })
    const sofiaId = sofia._id.$oid
    const handle = await ctx.newPage()
    const { page } = handle
    await signInWithForm(page, ctx.webUrl, '/recruiter/sign-in', ctx.seedCredentials.email('sarah'), ctx.seedCredentials.password)
    await page.goto(`${ctx.webUrl}/recruiter/find-candidates`, { waitUntil: 'networkidle0' })
    await page.click(`article[data-candidate="${sofiaId}"] button[aria-pressed="false"]`)
    await page.waitForSelector(`article[data-candidate="${sofiaId}"] button[aria-pressed="true"]`)

    await page.goto(`${ctx.webUrl}/recruiter/shortlists`, { waitUntil: 'networkidle0' })
    await page.waitForSelector(`article[data-candidate="${sofiaId}"]`)
    await waitForText(page, 'Added by Sarah Miller')
    await ctx.screenshot(page, '1-shortlisted')

    await db('users', 'updateMany', { filter: { _id: sofia._id }, update: { $set: { 'privacy.discoverable': false } } })
    await page.reload({ waitUntil: 'networkidle0' })
    await waitForText(page, '1 shortlisted candidate is no longer available.')
    ctx.check(!(await page.$(`article[data-candidate="${sofiaId}"]`)), 'Sofia is hidden')
    await ctx.screenshot(page, '2-hidden')
    await db('users', 'updateMany', { filter: { _id: sofia._id }, update: { $set: { 'privacy.discoverable': true } } })

    const [emma] = await db('users', 'find', { filter: { email: ctx.seedCredentials.email('emma') } })
    await page.goto(`${ctx.webUrl}/recruiter/find-candidates/${emma._id.$oid}/notes`, { waitUntil: 'networkidle0' })
    await setTextarea(page, 'textarea[name="note"]', 'x'.repeat(5001))
    await page.click('button[type="submit"]')
    await waitForText(page, 'Use at most 5000 characters.')
    await setTextarea(page, 'textarea[name="note"]', 'Strong portfolio; ask about design systems governance.')
    await page.click('button[type="submit"]')
    await waitForText(page, 'Notes saved.')
    await waitForText(page, 'Last updated by Sarah Miller')
    await ctx.screenshot(page, '3-note')
    ctx.assertClean(handle.issues, 'shortlist and notes')
  },
}
