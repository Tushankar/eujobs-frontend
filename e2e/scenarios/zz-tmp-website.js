// TEMPORARY (2026-11-13): the landing page's reviews, blog, newsletter and pricing, end to end through the UI.
// Uses seeded demo accounts (no Google Places, whose key currently answers 403).
import { join } from 'node:path'
import { FIXTURES_DIR } from '../fixtures/make.js'
import { openAsAdmin } from '../lib/admins.js'
import { bodyText, chooseFile, clickText, fill, signInWithForm, waitForSettled, waitForText } from '../lib/flows.js'
import { linkToken, uniqueEmail } from '../lib/testApi.js'

const REVIEW = 'The salary ranges on every job saved me so many awkward first calls. Clear, honest and quick to apply.'

/** Writes a review in Settings › Review as a seeded account. */
async function writeReview(ctx, email, signIn, path, stars, text) {
  const handle = await ctx.newPage()
  const { page } = handle
  await signInWithForm(page, ctx.webUrl, signIn, email, ctx.seedCredentials.password)
  await page.goto(`${ctx.webUrl}${path}`, { waitUntil: 'networkidle0' })
  await page.click(`input[name="rating"][value="${stars}"]`)
  await fill(page, 'textarea[name="text"]', text)
  await clickText(page, 'Submit review')
  await waitForText(page, 'sent for approval')
  await waitForText(page, 'Waiting for approval')
  await ctx.screenshot(page, `review-${stars}`)
  ctx.assertClean(handle.issues, `review ${stars}`)
}

/** Admin writes and publishes a post; a candidate and a recruiter review; the admin approves both. */
async function addContent(ctx, admin, title) {
  const { page } = admin
  await page.goto(`${ctx.webUrl}/admin/website/blog/new`, { waitUntil: 'networkidle0' })
  await fill(page, 'input[name="title"]', title)
  await fill(page, 'textarea[name="excerpt"]', 'How to listen, learn and deliver an early win in your first three months.')
  await fill(page, 'textarea[name="bodyMarkdown"]', '## Before the interview\n\nMeet your team and ask **what success looks like**.\n\n- Listen first\n- Ship one small win')
  await chooseFile(page, '#blog-cover', join(FIXTURES_DIR, 'cover.jpg'))
  await page.waitForSelector('img[class*="coverPreview"]')
  await clickText(page, 'Publish', 'button')
  await waitForText(page, 'is published')
  await ctx.screenshot(page, 'admin-post-published')

  await writeReview(ctx, ctx.seedCredentials.email('alex'), '/sign-in', '/candidate/settings/review', 5, REVIEW)
  await writeReview(ctx, 'maya.brooks@example.com', '/recruiter/sign-in', '/recruiter/settings/review', 4, 'I had applicants from three countries within days. Clean tools for a small hiring team.')

  await page.goto(`${ctx.webUrl}/admin/moderation/reviews`, { waitUntil: 'networkidle0' })
  await waitForText(page, REVIEW)
  await ctx.screenshot(page, 'admin-reviews-pending')
  for (let index = 0; index < 2; index++) {
    await clickText(page, 'Approve', 'button')
    await waitForText(page, 'now shows on the home page')
    await waitForSettled(page)
  }
  ctx.assertClean(admin.issues, 'admin')
}

export default {
  name: 'TMP Website sections',
  viewports: ['D', 'M'],
  async run(ctx) {
    const desktop = ctx.viewport === 'D'
    // seed:demo's posts and reviews are there from the start; the desktop run adds one post and two reviews.
    const title = desktop ? 'Your First 90 Days in a New Role' : 'How to Land a Remote Job in the EU in 2026'
    const admin = await ctx.newPage()
    await openAsAdmin(ctx, admin, ctx.seedCredentials.email(), '/admin/website', ctx.seedCredentials.password)
    await waitForText(admin.page, 'How to Land a Remote Job in the EU in 2026')
    await ctx.screenshot(admin.page, 'admin-website')
    if (desktop) await addContent(ctx, admin, title)

    // The visitor's landing page.
    const visitor = await ctx.newPage()
    const { page } = visitor
    await page.goto(`${ctx.webUrl}/`, { waitUntil: 'networkidle0' })
    await page.waitForSelector('[aria-labelledby="reviews-title"]')
    await page.waitForSelector('[aria-labelledby="blog-title"]')
    const text = await bodyText(page)
    for (const wanted of ['What Our Users Are Saying', title, 'Join Our Newsletter to', 'Pricing Plan', 'Blog']) ctx.check(text.includes(wanted), `landing shows "${wanted}"`)
    const shown = await page.$$eval('[aria-labelledby="reviews-title"] article', (items) => items.length)
    ctx.check(shown === 2, `two reviews shown (${shown})`)
    // The review arrows page through all six.
    await page.click('[aria-labelledby="reviews-title"] button[aria-label="Next reviews"]')
    await waitForText(page, '2 / 3')
    for (const [selector, name] of [
      ['[aria-labelledby="reviews-title"]', 'landing-reviews'],
      ['[aria-labelledby="blog-title"]', 'landing-blog'],
      ['footer', 'landing-footer'],
    ]) {
      await page.$eval(selector, (element) => element.scrollIntoView({ block: 'start' }))
      await new Promise((resolve) => setTimeout(resolve, 1600))
      await ctx.screenshot(page, name)
    }
    // Covers load lazily, once the section is on screen.
    await page.$eval('[aria-labelledby="blog-title"]', (element) => element.scrollIntoView({ block: 'center' }))
    await page.waitForFunction(() => [...document.querySelectorAll('[aria-labelledby="blog-title"] article img')].every((img) => img.complete && img.naturalWidth > 0), { timeout: 15_000 })
    ctx.check((await page.$$('[aria-labelledby="blog-title"] article img')).length === 3, 'three blog covers')

    // Newsletter double opt-in from the footer.
    const email = uniqueEmail(`news${ctx.viewport}`)
    await fill(page, 'footer input[type="email"]', email)
    await page.click('footer form button[type="submit"]')
    await waitForText(page, 'Check your inbox')
    const token = await linkToken(email, 'newsletter_confirm')
    await page.goto(`${ctx.webUrl}/newsletter/confirm?token=${token}`, { waitUntil: 'networkidle0' })
    await clickText(page, 'Confirm subscription', 'button')
    await waitForText(page, 'You’re subscribed')
    await ctx.screenshot(page, 'newsletter-confirmed')

    // A seeded post, the blog list and pricing.
    await page.goto(`${ctx.webUrl}/blog/21-job-interview-tips-how-to-make-a-great-impression`, { waitUntil: 'networkidle0' })
    await waitForText(page, 'Before the interview')
    ctx.check(!(await page.$('article script')), 'post body has no script')
    await ctx.screenshot(page, 'blog-post')
    await page.goto(`${ctx.webUrl}/blog`, { waitUntil: 'networkidle0' })
    await waitForText(page, title)
    await ctx.screenshot(page, 'blog-list')
    await page.goto(`${ctx.webUrl}/pricing`, { waitUntil: 'networkidle0' })
    await waitForText(page, '/ month')
    await ctx.screenshot(page, 'pricing-candidates')
    await clickText(page, 'For recruiters', 'button')
    await waitForText(page, 'Recruiter')
    await ctx.screenshot(page, 'pricing-recruiters')
    ctx.assertClean(visitor.issues, 'visitor')

    // Admin › Website › Subscribers lists the confirmed address.
    await admin.page.goto(`${ctx.webUrl}/admin/website/subscribers`, { waitUntil: 'networkidle0' })
    await waitForText(admin.page, email)
    await ctx.screenshot(admin.page, 'admin-subscribers')
    ctx.assertClean(admin.issues, 'admin subscribers')
  },
}
