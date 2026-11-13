// TEMPORARY (2026-11-13): the landing page's reviews, blog, newsletter and pricing, end to end through the UI.
import { join } from 'node:path'
import { FIXTURES_DIR } from '../fixtures/make.js'
import { openAsAdmin } from '../lib/admins.js'
import { completeCandidate } from '../lib/applicants.js'
import { bodyText, chooseFile, clickText, fill, signInWithForm, waitForSettled, waitForText } from '../lib/flows.js'
import { approvedRecruiter } from '../lib/recruiters.js'
import { linkToken, TEST_PASSWORD, uniqueEmail } from '../lib/testApi.js'

const REVIEW = 'The smart job recommendations saved me so much time. I did not even know some of these roles existed.'

/** Writes a review in Settings › Review. */
async function writeReview(ctx, user, signIn, path, stars, text) {
  const handle = await ctx.newPage()
  const { page } = handle
  await signInWithForm(page, ctx.webUrl, signIn, user.email, TEST_PASSWORD)
  await page.goto(`${ctx.webUrl}${path}`, { waitUntil: 'networkidle0' })
  await page.click(`input[name="rating"][value="${stars}"]`)
  await fill(page, 'textarea', text)
  await clickText(page, 'Submit review')
  await waitForText(page, 'sent for approval')
  await waitForText(page, 'Waiting for approval')
  await ctx.screenshot(page, `review-${stars}`)
  ctx.assertClean(handle.issues, `review ${stars}`)
}

export default {
  name: 'TMP Website sections',
  viewports: ['D', 'M'],
  async run(ctx) {
    const tag = ctx.viewport
    const candidate = await completeCandidate(`Review${tag}`)
    const recruiter = await approvedRecruiter(`Review${tag}`)

    // Admin › Website › New post, with a cover, published.
    const admin = await ctx.newPage()
    await openAsAdmin(ctx, admin, ctx.seedCredentials.email(), '/admin/website', ctx.seedCredentials.password)
    await ctx.screenshot(admin.page, 'admin-website-empty')
    await admin.page.goto(`${ctx.webUrl}/admin/website/blog/new`, { waitUntil: 'networkidle0' })
    const title = `${tag} 21 Job Interview Tips: How To Make a Great Impression`
    await fill(admin.page, 'input', title)
    const [excerpt, body] = await admin.page.$$('textarea')
    await excerpt.type('What to prepare before, during and after the interview.')
    await body.type('## Before the interview\n\nResearch the company and prepare **two questions** of your own.\n\n- Arrive early\n- Bring your CV')
    await chooseFile(admin.page, '#blog-cover', join(FIXTURES_DIR, 'cover.jpg'))
    await admin.page.waitForSelector('img[class*="coverPreview"]')
    await clickText(admin.page, 'Publish', 'button')
    await waitForText(admin.page, 'is published')
    await ctx.screenshot(admin.page, 'admin-post-published')

    await writeReview(ctx, candidate, '/candidate/sign-in', '/candidate/settings/review', 5, REVIEW)
    await writeReview(ctx, recruiter, '/recruiter/sign-in', '/recruiter/settings/review', 4, 'I had applicants from three countries within days. Clean tools for a small hiring team.')

    // Moderation › Reviews: approve both.
    await admin.page.goto(`${ctx.webUrl}/admin/moderation/reviews`, { waitUntil: 'networkidle0' })
    await waitForText(admin.page, REVIEW)
    await ctx.screenshot(admin.page, 'admin-reviews-pending')
    for (let index = 0; index < 2; index++) {
      await clickText(admin.page, 'Approve', 'button')
      await waitForText(admin.page, 'now shows on the home page')
      await waitForSettled(admin.page)
    }
    ctx.assertClean(admin.issues, 'admin')

    // The visitor's landing page.
    const visitor = await ctx.newPage()
    const { page } = visitor
    await page.goto(`${ctx.webUrl}/`, { waitUntil: 'networkidle0' })
    await page.waitForSelector('[aria-labelledby="reviews-title"]')
    await page.waitForSelector('[aria-labelledby="blog-title"]')
    const text = await bodyText(page)
    for (const wanted of ['What Our Users Are Saying', 'Latest', title, 'Join Our Newsletter to', 'Pricing Plan', 'Blog']) ctx.check(text.includes(wanted), `landing shows "${wanted}"`)
    const reviewNames = await page.$$eval('[aria-labelledby="reviews-title"] article strong', (items) => items.map((item) => item.textContent))
    ctx.check(reviewNames.length === 2, `two reviews shown (${reviewNames})`)
    const cover = await page.$eval('[aria-labelledby="blog-title"] article img', (img) => img.complete && img.naturalWidth > 0)
    ctx.check(cover, 'blog cover image loads')
    for (const [selector, name] of [
      ['[aria-labelledby="reviews-title"]', 'landing-reviews'],
      ['[aria-labelledby="blog-title"]', 'landing-blog'],
      ['footer', 'landing-footer'],
    ]) {
      await page.$eval(selector, (element) => element.scrollIntoView({ block: 'start' }))
      await new Promise((resolve) => setTimeout(resolve, 1600))
      await ctx.screenshot(page, name)
    }

    // Newsletter double opt-in from the footer.
    const email = uniqueEmail(`news${tag}`)
    await fill(page, 'footer input[type="email"]', email)
    await page.click('footer form button[type="submit"]')
    await waitForText(page, 'Check your inbox')
    const token = await linkToken(email, 'newsletter_confirm')
    await page.goto(`${ctx.webUrl}/newsletter/confirm?token=${token}`, { waitUntil: 'networkidle0' })
    await clickText(page, 'Confirm subscription', 'button')
    await waitForText(page, 'You’re subscribed')
    await ctx.screenshot(page, 'newsletter-confirmed')

    // Blog post, blog list and pricing.
    await page.goto(`${ctx.webUrl}/`, { waitUntil: 'networkidle0' })
    await page.$eval('[aria-labelledby="blog-title"] article h3 a', (link) => link.click())
    await page.waitForFunction(() => location.pathname.startsWith('/blog/'))
    await waitForText(page, 'Before the interview')
    ctx.check(!(await page.$('article script')), 'post body has no script')
    await ctx.screenshot(page, 'blog-post')
    await page.goto(`${ctx.webUrl}/blog`, { waitUntil: 'networkidle0' })
    await waitForText(page, title)
    await ctx.screenshot(page, 'blog-list')
    await page.goto(`${ctx.webUrl}/pricing`, { waitUntil: 'networkidle0' })
    await waitForText(page, 'Plus')
    await ctx.screenshot(page, 'pricing-candidates')
    await clickText(page, 'For recruiters', 'button')
    await waitForText(page, 'Recruiter Plus')
    await ctx.screenshot(page, 'pricing-recruiters')
    ctx.assertClean(visitor.issues, 'visitor')

    // Admin › Website › Subscribers lists the confirmed address.
    await admin.page.goto(`${ctx.webUrl}/admin/website/subscribers`, { waitUntil: 'networkidle0' })
    await waitForText(admin.page, email)
    await ctx.screenshot(admin.page, 'admin-subscribers')
    ctx.assertClean(admin.issues, 'admin subscribers')
  },
}
