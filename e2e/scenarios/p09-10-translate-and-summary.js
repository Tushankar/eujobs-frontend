import { PLACES } from '../../server/seed/data/places.js'
import { completeCandidate, recruiterWithJob } from '../lib/applicants.js'
import { clickText, signInWithForm, waitForText } from '../lib/flows.js'
import { startApi } from '../lib/messages.js'
import { openAs } from '../lib/payments.js'
import { login } from '../lib/recruiters.js'
import { api, TEST_PASSWORD } from '../lib/testApi.js'

const GERMAN_BRIEF = 'Gestalte unsere Recruiting-Werkzeuge von der Forschung bis zum fertigen Produkt in einem kleinen, freundlichen Team.'
const GERMAN_MESSAGE = 'Hallo Emma, dein Profil hat uns gefallen. Hast du nächste Woche Zeit für ein kurzes Gespräch?'
const GERMAN_ABOUT = 'Ich gestalte ruhige, barrierefreie Werkzeuge für Teams und arbeite gern eng mit Entwicklern zusammen.'

/** Clicks Translate inside `scope` and returns the text shown there once the translation is in. */
async function translate(page, scope, original) {
  await clickText(page, 'Translate', `${scope} button`)
  await page.waitForFunction((selector) => document.querySelector(selector)?.innerText.includes('Translated by AI'), { timeout: 60_000 }, scope)
  const text = await page.$eval(scope, (element) => element.innerText)
  return { text, changed: !text.includes(original) }
}

/**
 * P9-10 (M-144, M-117, M-062): Emma (Plus) translates a German job brief and a German message into English; a recruiter
 * translates a candidate's German About for free; a Free candidate's Translate opens the upgrade dialog. Emma's profile
 * Ai Job Summary is written by AI and copies to the clipboard.
 */
export default {
  name: 'P9-10 Translate and profile summary',
  viewports: ['D'],
  async run(ctx) {
    const { recruiter, job } = await recruiterWithJob('Uebersetzen', { brief: GERMAN_BRIEF })
    const emmaEmail = ctx.seedCredentials.email('emma')
    const emmaToken = await login(emmaEmail, 'candidate', ctx.seedCredentials.password)
    const emma = (await api('/me', { token: emmaToken })).body
    const thread = (await startApi(recruiter.token, { candidateId: emma.id, jobId: job.id, body: GERMAN_MESSAGE })).body

    const handle = await ctx.newPage()
    const { page } = handle
    await openAs(ctx, handle, emmaEmail, `/candidate/jobs/${job.id}`, ctx.seedCredentials.password)
    const brief = await translate(page, '[data-translatable="brief"]', GERMAN_BRIEF)
    ctx.check(brief.changed, `the brief is translated: ${brief.text.replace(/\s+/g, ' ').slice(0, 120)}`)
    await ctx.screenshot(page, '1-brief')
    await clickText(page, 'Show original', '[data-translatable="brief"] button')
    await page.waitForFunction((text) => document.querySelector('[data-translatable="brief"]').innerText.includes(text), {}, GERMAN_BRIEF)

    await page.goto(`${ctx.webUrl}/candidate/messages/${thread.conversation?.id ?? thread.id}`, { waitUntil: 'networkidle0' })
    const message = await translate(page, '[data-message="theirs"]', GERMAN_MESSAGE)
    ctx.check(message.changed, `the message is translated: ${message.text.replace(/\s+/g, ' ').slice(0, 120)}`)
    await ctx.screenshot(page, '2-message')

    // M-062: the recruiter-ready summary, copied to the clipboard.
    await page.browserContext().overridePermissions(ctx.webUrl, ['clipboard-read', 'clipboard-write', 'clipboard-sanitized-write'])
    await page.goto(`${ctx.webUrl}/candidate/profile`, { waitUntil: 'networkidle0' })
    await page.click('[data-profile-summary-button]')
    await page.waitForSelector('[data-profile-summary] p:not([data-ai-state])', { visible: true, timeout: 60_000 })
    const summary = await page.$eval('[data-profile-summary] p:not([data-ai-state])', (element) => element.textContent)
    await clickText(page, 'Copy summary', '[role="dialog"] button')
    await waitForText(page, 'Summary copied to your clipboard.')
    ctx.check((await page.evaluate(() => navigator.clipboard.readText())) === summary, 'the summary is on the clipboard')
    await ctx.screenshot(page, '3-profile-summary')
    ctx.assertClean(handle.issues, 'Plus translate and summary')

    // A recruiter translates a candidate's German About for free (M-117).
    const author = await completeCandidate('Ueber', { plus: false })
    const profile = (await api('/candidate/profile', { token: author.token })).body
    await api('/candidate/profile', {
      method: 'PUT',
      token: author.token,
      body: { fullName: author.fullName, headline: profile.headline, placeId: PLACES.london.placeId, about: GERMAN_ABOUT, yearsExperience: profile.yearsExperience, skills: profile.skills, workPreference: profile.workPreference, availability: profile.availability },
    })
    const sarah = await ctx.newPage()
    await signInWithForm(sarah.page, ctx.webUrl, '/recruiter/sign-in', ctx.seedCredentials.email('sarah'), ctx.seedCredentials.password)
    await sarah.page.goto(`${ctx.webUrl}/recruiter/find-candidates/${author.id}`, { waitUntil: 'networkidle0' })
    const about = await translate(sarah.page, '[data-translatable="about"]', GERMAN_ABOUT)
    ctx.check(about.changed, `the About is translated: ${about.text.replace(/\s+/g, ' ').slice(0, 120)}`)
    await ctx.screenshot(sarah.page, '4-recruiter-about')
    ctx.assertClean(sarah.issues, 'recruiter translate')

    // Free: Translate carries a lock and opens the upgrade dialog without a request.
    const free = await ctx.newPage()
    const requests = []
    free.page.on('request', (request) => request.url().includes('/translate') && requests.push(request.url()))
    await openAs(ctx, free, author.email, `/candidate/jobs/${job.id}`, TEST_PASSWORD)
    await free.page.waitForSelector('[data-translatable="brief"] [data-ai-locked]', { visible: true })
    await free.page.click('[data-translatable="brief"] [data-ai-locked]')
    await free.page.waitForSelector('[role="dialog"]', { visible: true })
    ctx.check(requests.length === 0, 'no translate request from a Free candidate')
    await ctx.screenshot(free.page, '5-free-locked')
    ctx.assertClean(free.issues, 'Free translate')
  },
}
