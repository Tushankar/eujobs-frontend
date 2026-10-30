import { randomUUID } from 'node:crypto'
import { clickText, pageApi, setValue, signInWithForm, waitForText } from '../lib/flows.js'
import { onboardedCandidate } from '../lib/candidates.js'
import { api, db, TEST_PASSWORD } from '../lib/testApi.js'

const NON_EU = /Canada|USA|United States|Brazil|Australia|Norway|Switzerland/

/** Types into the city field and returns the suggestions shown for that text (not the previous search's). */
async function suggestions(page, text) {
  await setValue(page, 'input[role="combobox"]', '')
  await page.type('input[role="combobox"]', text)
  await page.waitForFunction(
    (typed) => [...document.querySelectorAll('[role="option"]')].some((option) => option.innerText.toLowerCase().includes(typed.toLowerCase())),
    { timeout: 15_000 },
    text,
  )
  return page.$$eval('[role="option"]', (options) => options.map((option) => option.innerText.replace(/\s+/g, ' ').trim()))
}

/**
 * P3-13 (G-1, P3-Q1, P3-Q2): the city field suggests EU 27 + UK cities through the proxy (never Google from the
 * browser), a picked city is saved as { countryCode, city, placeId } and shown after reload, the islands and
 * Mediterranean cities are found, and a Spanish user's request returns Spanish names.
 */
export default {
  name: 'P3-13 City field',
  viewports: ['D', 'M'],
  async run(ctx) {
    const { email, token } = await onboardedCandidate('City')
    const handle = await ctx.newPage()
    const { page } = handle
    const googleRequests = []
    page.on('request', (request) => {
      if (request.url().includes('googleapis.com')) googleRequests.push(request.url())
    })
    await signInWithForm(page, ctx.webUrl, '/sign-in', email, TEST_PASSWORD)
    await page.goto(`${ctx.webUrl}/candidate/profile`, { waitUntil: 'networkidle0' })
    await clickText(page, 'Edit profile', 'button')
    await page.waitForSelector('input[name="headline"]')

    const london = await suggestions(page, 'Lond')
    ctx.note(`Lond: ${london.join(' | ')}`)
    ctx.check(london.every((text) => !NON_EU.test(text)), `only EU 27 + UK suggestions: ${london.join(' | ')}`)
    for (const city of ['Las Palmas', 'Funchal', 'Limassol', 'Valletta']) {
      const found = await suggestions(page, city)
      ctx.check(found.length > 0, `${city} shows suggestions`)
      ctx.note(`${city}: ${found[0]}`)
    }

    const manchester = await suggestions(page, 'Manchester')
    ctx.check(manchester.some((text) => text.includes('UK')), 'Manchester, UK is suggested')
    await ctx.screenshot(page, '1-suggestions')
    await clickText(page, 'Manchester', '[role="option"]')
    await page.waitForFunction(() => document.querySelector('input[role="combobox"]').value.startsWith('Manchester, United Kingdom'))
    await page.type('input[name="headline"]', 'Product Designer')
    await page.type('textarea[name="about"]', 'I design calm, accessible products for complex domains.')
    await page.type('input[name="yearsExperience"]', '6')
    await page.type('input[name="skillDraft"]', 'Figma')
    await page.keyboard.press('Enter')
    await clickText(page, 'Save', '[role="dialog"] button')
    await waitForText(page, 'Profile saved.')
    await page.reload({ waitUntil: 'networkidle0' })
    await waitForText(page, 'Manchester, United Kingdom')
    await ctx.screenshot(page, '2-saved')

    const [user] = await db('users', 'find', { filter: { email } })
    const [profile] = await db('candidateprofiles', 'find', { filter: { userId: user._id } })
    ctx.check(JSON.stringify(Object.keys(profile.location).sort()) === JSON.stringify(['city', 'countryCode', 'placeId']), 'stored as { countryCode, city, placeId } only')
    ctx.check(profile.location.city === 'Manchester' && profile.location.countryCode === 'GB', 'Manchester, GB is stored')
    ctx.check(googleRequests.length === 0, `no request from the browser to Google (${googleRequests.length})`)
    ctx.assertClean(handle.issues, 'city field')

    // P3-Q2: the same signed-in page asks for "Lond" as a Spanish user.
    await api('/me', { method: 'PATCH', token, body: { language: 'es', languageExplicit: true } })
    try {
      const spanish = await pageApi(page, `/places/autocomplete?input=Lond&sessionToken=${randomUUID()}`)
      const names = spanish.body.items.map((item) => item.city)
      ctx.note(`Lond (es): ${spanish.body.items.map((item) => `${item.city}, ${item.secondary}`).join(' | ')}`)
      ctx.check(names.includes('Londres'), `Spanish names for a Spanish user: ${names.join(', ')}`)
    } finally {
      await api('/me', { method: 'PATCH', token, body: { language: 'en', languageExplicit: true } })
    }
  },
}
