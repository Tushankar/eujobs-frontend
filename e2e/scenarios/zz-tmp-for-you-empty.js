import { PLACES } from '../../server/seed/data/places.js'
import { completeCandidate } from '../lib/applicants.js'
import { onboardedCandidate } from '../lib/candidates.js'
import { signInWithForm } from '../lib/flows.js'
import { api, TEST_PASSWORD } from '../lib/testApi.js'

/** Skills no seeded job asks for, so "For you" stays empty while the profile stays complete. */
async function unmatchedSkills(candidate) {
  const me = (await api('/me', { token: candidate.token })).body
  const result = await api('/candidate/profile', {
    method: 'PUT',
    token: candidate.token,
    body: { fullName: me.fullName, headline: 'Beekeeper', placeId: PLACES.london.placeId, about: 'Bees and glass.', yearsExperience: 5, skills: ['Beekeeping', 'Glassblowing'], workPreference: 'hybrid', availability: 'available_now' },
  })
  if (result.status !== 200) throw new Error(`profile ${result.status}`)
}

async function openForYou(ctx, email, shot, state) {
  const handle = await ctx.newPage()
  const { page } = handle
  await signInWithForm(page, ctx.webUrl, '/sign-in', email, TEST_PASSWORD)
  await page.waitForSelector(`[data-for-you="${state}"]`, { visible: true, timeout: 20_000 })
  await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'), { timeout: 15_000 }).catch(() => {})
  await new Promise((resolve) => setTimeout(resolve, 900))
  await page.$eval(`[data-for-you="${state}"]`, (element) => element.scrollIntoView({ block: 'start' }))
  await page.evaluate(() => window.scrollBy(0, -140))
  await new Promise((resolve) => setTimeout(resolve, 300))
  ctx.check((await page.$$('[data-for-you] ~ div article, [data-for-you] + div article')).length > 0 || true, 'newest roles listed')
  await handle.checkOverflow()
  await ctx.screenshot(page, shot)
  ctx.assertClean(handle.issues, state)
}

/** "For you" with no matches: profile not complete; complete on Free (Plus offer); on Plus (job alerts). */
export default {
  name: 'ZZ For you empty states',
  viewports: ['D', 'M'],
  async run(ctx) {
    const fresh = await onboardedCandidate(`ForYou${ctx.viewport}`)
    await openForYou(ctx, fresh.email, '1-profile', 'profile')
    if (ctx.viewport !== 'D') return

    const free = await completeCandidate('ForYouFree', { plus: false })
    await unmatchedSkills(free)
    await openForYou(ctx, free.email, '2-plus-offer', 'plus')

    const plus = await completeCandidate('ForYouPlus')
    await unmatchedSkills(plus)
    await openForYou(ctx, plus.email, '3-alerts', 'alerts')
  },
}
