import { clickText, fill, signInWithForm, waitForText } from '../lib/flows.js'
import { oid, tick } from '../lib/matching.js'
import { ownerToken } from '../lib/recruiters.js'
import { api, db } from '../lib/testApi.js'

const policyRow = async (name) => (await db('matchingpolicies', 'find', { filter: { name } }))[0]
const versionsOf = async (policy) => db('matchingpolicyversions', 'count', { filter: { policyId: policy._id } })
/** Clicks a signal switch, centred first so the sticky header never covers it. */
async function signal(page, label) {
  const selector = `button[role="switch"][aria-label="${label}"]`
  await page.$eval(selector, (element) => element.scrollIntoView({ block: 'center' }))
  await page.click(selector)
}

/**
 * P9-05 (M-048, M-049, P9-Q4, U5): the Owner creates a draft (at 1440 px "Improve description" asks OpenAI for the
 * description), switches experience off and saves version 2; a location-only policy is refused with "Turn on skills
 * or experience" and nothing is saved; activating recomputes every score with the renormalised weights; a draft is
 * archived. The default policy is active again at the end, so later scenarios see the seeded scores.
 */
export default {
  name: 'P9-05 Policy',
  viewports: ['D', 'M'],
  async run(ctx) {
    const name = `E2E policy ${ctx.viewport} ${Date.now() % 100000}`
    const handle = await ctx.newPage()
    const { page } = handle
    // P9-Q4: the location-only save is refused on purpose.
    handle.allow(422, '/signals')
    await signInWithForm(page, ctx.webUrl, '/admin/sign-in', ctx.seedCredentials.email(), ctx.seedCredentials.password)
    await page.goto(`${ctx.webUrl}/admin/ai-matching`, { waitUntil: 'networkidle0' })
    await waitForText(page, 'Policy library')

    await clickText(page, 'Create policy', 'button')
    await page.waitForSelector('[role="dialog"] input', { visible: true })
    await fill(page, '[role="dialog"] input', name)
    await fill(page, '[role="dialog"] textarea', 'Product and design roles hired in the United Kingdom.')
    if (ctx.viewport === 'D') {
      await clickText(page, 'Improve description', '[role="dialog"] button')
      await waitForText(page, 'Suggestion added to the description', 45_000)
      const suggestion = await page.$eval('[role="dialog"] textarea', (element) => element.value)
      ctx.check(suggestion.length >= 20 && suggestion.length <= 500 && !suggestion.startsWith('Product and design roles hired in the United Kingdom.'), `OpenAI rewrote the description (${suggestion.length} characters)`)
      ctx.note(`Suggested: ${suggestion}`)
      await ctx.screenshot(page, '1-suggestion')
    }
    await clickText(page, 'Create draft policy', '[role="dialog"] button')
    await waitForText(page, `Draft policy “${name}” was created`)
    const created = await policyRow(name)
    ctx.check(created?.status === 'draft' && created.version === 1, 'a draft, version 1, every signal on')
    await page.waitForSelector(`[data-policy="${oid(created._id)}"]`, { visible: true })

    // Experience off → version 2; the history lists both.
    await signal(page, 'Relevant experience')
    await clickText(page, 'Save reviewed policy', 'button')
    await waitForText(page, 'Version 2 saved.')
    await waitForText(page, 'Version 1 ·')
    await handle.checkOverflow()
    await ctx.screenshot(page, '2-version-2')

    // P9-Q4: location alone cannot score.
    await signal(page, 'Relevant skills')
    await clickText(page, 'Save reviewed policy', 'button')
    await waitForText(page, 'Turn on skills or experience.')
    ctx.check((await versionsOf(created)) === 2, 'the location-only policy was not saved')
    await ctx.screenshot(page, '3-location-only-refused')
    await signal(page, 'Relevant skills')

    // Activate: every score is recomputed with skills only (weights renormalised) and the location cap.
    await clickText(page, 'Make active', 'button')
    await waitForText(page, `“${name}” is now the active policy`)
    await tick()
    const active = await policyRow(name)
    ctx.check(active.status === 'active', 'the new policy is active')
    const results = await db('matchresults', 'find')
    ctx.check(results.length > 0 && results.every((result) => oid(result.policyVersionId) === oid(active.versionId)), `all ${results.length} scores use version 2`)
    ctx.check(
      results.every((result) => result.score === (result.locationCapped ? 49 : Math.round(100 * result.skillShare))),
      'scores = 100 × required-skill share, capped at 49 on a location mismatch',
    )

    // Archive a second draft from the library.
    const token = await ownerToken()
    const other = (await api('/admin/matching/policies', { method: 'POST', token, body: { name: `${name} spare`, description: 'A spare draft that is archived by this scenario.' } })).body
    await page.reload({ waitUntil: 'networkidle0' })
    await clickText(page, `${name} spare`, 'button')
    await clickText(page, 'Archive draft', 'button')
    await waitForText(page, `“${name} spare” was archived.`)
    ctx.check((await policyRow(`${name} spare`)).status === 'archived', 'the draft is archived')
    await ctx.screenshot(page, '4-archived')
    ctx.check(other.status === 'draft', 'the spare started as a draft')

    // The default policy comes back for the scenarios that follow.
    const fallback = await policyRow('Default evidence policy')
    await api(`/admin/matching/policies/${oid(fallback._id)}/activate`, { method: 'POST', token })
    await tick()
    ctx.check((await policyRow('Default evidence policy')).status === 'active', 'the default policy is active again')
    ctx.assertClean(handle.issues, 'policies')
  },
}
