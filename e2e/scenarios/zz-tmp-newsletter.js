// TEMPORARY (2026-11-19): newsletter issues in admin › Website › Newsletter, end to end through the UI.
import { openAsAdmin } from '../lib/admins.js'
import { bodyText, clickText, fill, waitForSettled, waitForText } from '../lib/flows.js'
import { api, linkToken, mailTo, uniqueEmail } from '../lib/testApi.js'

async function subscribe(language) {
  const email = uniqueEmail('reader')
  await api('/newsletter', { method: 'POST', body: { email, language } })
  const token = (await linkToken(email, 'newsletter_confirm')).searchParams.get('token')
  await api('/newsletter/confirm', { method: 'POST', body: { token } })
  return email
}

const previewText = (page) =>
  page.evaluate(() => document.querySelector('iframe')?.srcdoc.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ') ?? '')

export default {
  name: 'TMP Newsletter issues',
  viewports: ['D', 'M'],
  async run(ctx) {
    const english = await subscribe('en')
    const french = await subscribe('fr')
    const admin = await ctx.newPage()
    const { page } = admin
    await openAsAdmin(ctx, admin, ctx.seedCredentials.email(), '/admin/website/newsletter', ctx.seedCredentials.password)
    await waitForText(page, 'No newsletter issues yet')
    await ctx.screenshot(page, 'newsletter-empty')

    await clickText(page, 'New issue', 'button')
    await waitForText(page, 'Newsletter issue')
    await page.waitForSelector('iframe')
    await waitForSettled(page)
    await ctx.screenshot(page, 'newsletter-draft')

    // The draft starts with jobs and posts, and previews them.
    const text = await bodyText(page)
    if (!text.includes('Jobs (') || !text.includes('Blog posts (')) throw new Error('the pickers are missing')
    await fill(page, 'input[name="subject"]', 'Fresh roles for May')
    await fill(page, 'textarea[name="intro"]', 'Hello, here is what is new.\n\nA few roles and one story.')
    await clickText(page, 'Save draft', 'button')
    await waitForText(page, 'Draft saved')
    await waitForSettled(page)
    const preview = await previewText(page)
    if (!preview.includes('Fresh roles for May') && !preview.includes('Hello, here is what is new.')) throw new Error(`the preview shows the saved intro: ${preview.slice(0, 200)}`)

    // French tab: empty subject falls back to English, and the preview is French chrome.
    await clickText(page, 'French', 'button[role="tab"]')
    await waitForText(page, 'Leave empty to send the English subject')
    await waitForSettled(page)
    if (!(await previewText(page)).includes('Nouvelles offres')) throw new Error('the French preview has no French section title')
    await ctx.screenshot(page, 'newsletter-french')

    await clickText(page, 'Send a test to me', 'button')
    await waitForText(page, 'test email in French')
    const tests = await mailTo(ctx.seedCredentials.email(), 'newsletter_issue')
    if (tests.length !== 1 || tests[0].language !== 'fr') throw new Error('the test email was not captured in French')

    // Send: a confirmation first, then the batches (run by a tick).
    await clickText(page, 'Send newsletter', 'button')
    await waitForText(page, 'cannot be recalled')
    await ctx.screenshot(page, 'newsletter-confirm')
    await clickText(page, 'Send newsletter', '[role="dialog"] button, [role="alertdialog"] button')
    await waitForText(page, 'Sending has started')
    await api('/_test/scheduler/tick', { method: 'POST', body: {} })
    await page.reload({ waitUntil: 'networkidle0' })
    await waitForText(page, 'emails sent')
    await ctx.screenshot(page, 'newsletter-sent')

    const toEnglish = await mailTo(english, 'newsletter_issue')
    const toFrench = await mailTo(french, 'newsletter_issue')
    if (toEnglish.length !== 1 || toFrench.length !== 1) throw new Error('each subscriber should get one issue')
    if (toEnglish[0].subject !== 'Fresh roles for May' || toFrench[0].subject !== 'Fresh roles for May') throw new Error('the French subscriber falls back to the English subject')
    if (!toFrench[0].params.secondaryLink.includes('/newsletter/unsubscribe?token=')) throw new Error('no unsubscribe link')

    // The list shows the sent issue; the subscriber's link unsubscribes them on the public page.
    await page.goto(`${ctx.webUrl}/admin/website/newsletter`, { waitUntil: 'networkidle0' })
    await waitForText(page, 'Fresh roles for May')
    await ctx.screenshot(page, 'newsletter-list')
    const visitor = await ctx.newPage()
    await visitor.page.goto(toEnglish[0].params.secondaryLink.replace(/^https?:\/\/[^/]+/, ctx.webUrl), { waitUntil: 'networkidle0' })
    await clickText(visitor.page, 'Unsubscribe', 'button')
    await waitForText(visitor.page, 'unsubscribed')
    ctx.assertClean(admin.issues, 'admin')
  },
}
