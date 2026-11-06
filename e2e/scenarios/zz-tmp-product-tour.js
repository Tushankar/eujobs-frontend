import { onboardedCandidate } from '../lib/candidates.js'
import { clickText, signInWithForm, waitForPath, waitForText } from '../lib/flows.js'
import { meOf, until } from '../lib/payments.js'
import { approvedRecruiter } from '../lib/recruiters.js'
import { TEST_PASSWORD } from '../lib/testApi.js'

const card = (page, id) => page.waitForSelector(`[data-tour-card="${id}"]`, { visible: true, timeout: 15_000 })
const cardButton = (page, text) => clickText(page, text, '[data-tour-card] button')

/** Records when the Overview heading and the welcome dialog first appear (performance.now()). */
const trackOpening = (page) =>
  page.evaluateOnNewDocument(() => {
    new MutationObserver(() => {
      if (!window.__overviewAt && document.querySelector('main h1')) window.__overviewAt = performance.now()
      if (!window.__welcomeAt && document.querySelector('[role="dialog"]')?.textContent.includes('Start the tour')) window.__welcomeAt = performance.now()
    }).observe(document, { childList: true, subtree: true })
  })

/** The welcome dialog opens right after the Overview shows (no wait on top of the page itself). */
async function checkImmediate(ctx, page, role) {
  const { overviewAt, welcomeAt } = await page.evaluate(() => ({ overviewAt: window.__overviewAt, welcomeAt: window.__welcomeAt }))
  const gap = Math.round(welcomeAt - overviewAt)
  ctx.check(gap < 400, `${role}: the welcome opens ${gap} ms after the Overview`)
}

/** Walks every step: the sidebar card, "Take me there", the page card (spotlit on desktop), then Next / Finish. */
async function walk(ctx, page, role, steps) {
  await waitForText(page, 'Welcome,')
  await checkImmediate(ctx, page, role)
  // The intro shows the role's paid plan with its live price and features.
  const offer = await page.waitForSelector('[data-tour-plan="offer"]', { timeout: 15_000 })
  const offerText = await offer.evaluate((element) => element.innerText)
  ctx.check(/per month/.test(offerText) && /\d/.test(offerText) && (await offer.$('[data-plan-features]')), `${role} intro shows the plan price and features (${offerText.replace(/\n/g, ' ').slice(0, 120)})`)
  await ctx.screenshot(page, `${role}-0-welcome`)
  await clickText(page, 'Start the tour', '[role="dialog"] button')
  for (const [index, { key, path }] of steps.entries()) {
    await card(page, key)
    if (index === 0) await ctx.screenshot(page, `${role}-1-sidebar-step`)
    await cardButton(page, 'Take me there')
    await waitForPath(page, path)
    await card(page, `${key}-page`)
    // The spotlight finds the page's main action once the page has loaded (desktop and phone).
    await page.waitForSelector('[class*="hole"]', { timeout: 10_000 }).catch(() => ctx.check(false, `${role} ${key}: no spotlight on the page`))
    await new Promise((resolve) => setTimeout(resolve, 600))
    await ctx.screenshot(page, `${role}-${index + 2}-${key}`)
    await cardButton(page, index === steps.length - 1 ? 'Finish' : 'Next')
  }
  await waitForText(page, "You're all set")
  await new Promise((resolve) => setTimeout(resolve, 400))
  await ctx.screenshot(page, `${role}-9-done`)
}

/** The first-login product tour for a new candidate and a new recruiter: shown once, recorded, replayable. */
export default {
  name: 'ZZ Product tour',
  viewports: ['D', 'M'],
  async run(ctx) {
    const candidate = await onboardedCandidate(`Tour${ctx.viewport}`, { tour: true })
    ctx.check((await meOf(candidate.token)).tourPending === true, 'a new candidate has the tour pending')
    const handle = await ctx.newPage()
    const { page } = handle
    await trackOpening(page)
    await signInWithForm(page, ctx.webUrl, '/sign-in', candidate.email, TEST_PASSWORD)
    await walk(ctx, page, 'candidate', [
      { key: 'cv', path: '/candidate/cv-versions' },
      { key: 'profile', path: '/candidate/profile' },
      { key: 'jobs', path: '/candidate/jobs' },
      { key: 'applications', path: '/candidate/applications' },
    ])
    await clickText(page, 'Upload my CV', '[role="dialog"] button')
    await waitForPath(page, "/candidate/cv-versions")
    await until(() => meOf(candidate.token), (me) => me.tourPending === false, { timeout: 10_000, label: 'the candidate tour is recorded' })

    // Shown once: the Overview opens without it after a reload.
    await page.goto(`${ctx.webUrl}/candidate`, { waitUntil: 'networkidle0' })
    await new Promise((resolve) => setTimeout(resolve, 1200))
    ctx.check(!(await page.evaluate(() => document.body.innerText.includes('Start the tour'))), 'the tour does not open again')

    // Replay from the profile menu, then skip.
    await page.click('button[aria-label="Open profile menu"]')
    await clickText(page, 'Take the product tour')
    await waitForText(page, 'Start the tour')
    await handle.checkOverflow()
    await clickText(page, 'Skip for now', '[role="dialog"] button')
    ctx.assertClean(handle.issues, 'candidate')

    const recruiter = await approvedRecruiter(`TourRec${ctx.viewport}`, { tour: true, plus: false })
    ctx.check((await meOf(recruiter.token)).tourPending === true, 'a new recruiter has the tour pending')
    const second = await ctx.newPage()
    await trackOpening(second.page)
    await signInWithForm(second.page, ctx.webUrl, '/recruiter/sign-in', recruiter.email, TEST_PASSWORD)
    await walk(ctx, second.page, 'recruiter', [
      { key: 'company', path: '/recruiter/company' },
      { key: 'jobs', path: '/recruiter/jobs' },
      { key: 'candidates', path: '/recruiter/find-candidates' },
      { key: 'pipeline', path: '/recruiter/hiring-pipeline' },
    ])
    await clickText(second.page, 'Post a job', '[role="dialog"] button')
    await waitForPath(second.page, "/recruiter/jobs/new")
    await until(() => meOf(recruiter.token), (me) => me.tourPending === false, { timeout: 10_000, label: 'the recruiter tour is recorded' })
    ctx.assertClean(second.issues, 'recruiter')
  },
}
