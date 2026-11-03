import { clickText, responseTo, signInWithForm, waitForText } from '../lib/flows.js'
import { approvedRecruiter, login } from '../lib/recruiters.js'
import { api, db, TEST_PASSWORD } from '../lib/testApi.js'

const LEVELS = ['a1', 'a2', 'b1', 'b2', 'c1', 'c2', 'native']

/**
 * P4-12 (M-054, M-055, M-056, OD4, OQ-6a, OQ-6f): in the Germany view only email-verified, discoverable,
 * consenting, complete candidates living in Germany or with a valid EU right to work are listed; the right-to-work,
 * language ≥ B2 and Verified filters behave per §3.8; a hidden or incomplete candidate never shows; Remote lists
 * work preference remote.
 */
export default {
  name: 'P4-12 Find candidates',
  viewports: ['D', 'M'],
  async run(ctx) {
    const recruiter = await approvedRecruiter('Discovery', { city: 'berlin' })
    const token = await login(recruiter.email)
    const list = async (query = '') => (await api(`/recruiter/candidates${query}`, { token })).body.items
    const names = (items) => items.map((item) => item.fullName).sort()

    // Seeded people: Oliver lives in Berlin; James Chen, Sofia, Daniel and Aisha have an EU right to work; Emma (UK) and Alex (incomplete) do not qualify.
    const germany = await list()
    ctx.check(JSON.stringify(names(germany)) === JSON.stringify(['Aisha Patel', 'Daniel Kim', 'James Chen', 'Oliver Park', 'Sofia Martinez']), `the Germany population (got ${names(germany)})`)
    ctx.check(germany.every((item) => item.location.countryCode === 'DE' || item.rightToWork.some((entry) => entry.region === 'eu' && entry.valid)), 'everyone lives in DE or may work in the EU')

    const handle = await ctx.newPage()
    const { page } = handle
    await signInWithForm(page, ctx.webUrl, '/recruiter/sign-in', recruiter.email, TEST_PASSWORD)
    await page.goto(`${ctx.webUrl}/recruiter/find-candidates`, { waitUntil: 'networkidle0' })
    await waitForText(page, '5 candidates')
    await waitForText(page, 'live in Germany or have the right to work there')
    await handle.checkOverflow()
    await ctx.screenshot(page, '1-germany')

    // Filters in the browser: language German at B2 or above, right to work, verified only.
    await clickText(page, 'Filters', 'button')
    const byLanguage = responseTo(page, ['/api/v1/recruiter/candidates?', 'language=de', 'languageLevel=b2'])
    await page.select('select[name="language"]', 'de')
    await page.select('select[name="languageLevel"]', 'b2')
    await byLanguage
    const german = await list('?language=de&languageLevel=b2')
    ctx.check(german.every((item) => item.languages.some((language) => language.code === 'de' && LEVELS.indexOf(language.level) >= LEVELS.indexOf('b2'))), 'everyone listed speaks German at B2 or above')
    await waitForText(page, `${german.length} candidate`)
    await ctx.screenshot(page, '2-language-filter')
    const byChecks = responseTo(page, ['/api/v1/recruiter/candidates?', 'rightToWork=', 'verified='])
    await page.click('label:has(input[name="rightToWork"])')
    await page.click('label:has(input[name="verified"])')
    await byChecks
    const filtered = await list('?language=de&languageLevel=b2&rightToWork=1&verified=1')
    ctx.check(filtered.every((item) => item.verification.verified && item.rightToWork.some((entry) => entry.region === 'eu' && entry.valid)), 'verified with an EU right to work')
    await waitForText(page, `${filtered.length} candidate`)
    await handle.checkOverflow()

    // A hidden candidate is never listed; nor is an incomplete one (Alex).
    const [daniel] = await db('users', 'find', { filter: { email: 'daniel.kim@example.com' } })
    await db('users', 'updateMany', { filter: { _id: daniel._id }, update: { $set: { 'privacy.discoverable': false } } })
    ctx.check(!names(await list()).includes('Daniel Kim'), 'a hidden candidate is not listed')
    await db('users', 'updateMany', { filter: { _id: daniel._id }, update: { $set: { 'privacy.discoverable': true } } })
    ctx.check(!names(await list()).includes('Alex Morgan'), 'an incomplete candidate is not listed')

    // OQ-6a: Remote = work preference remote, in any country.
    await api('/me', { method: 'PATCH', token, body: { pickerCountry: 'REMOTE' } })
    const remote = await list()
    ctx.check(remote.length > 0 && remote.every((item) => item.workPreference === 'remote'), `Remote lists remote candidates only (got ${names(remote)})`)
    await page.reload({ waitUntil: 'networkidle0' })
    await waitForText(page, 'open to remote work')
    await waitForText(page, `${remote.length} candidate`)
    await ctx.screenshot(page, '3-remote')
    ctx.assertClean(handle.issues, 'find candidates')
  },
}
