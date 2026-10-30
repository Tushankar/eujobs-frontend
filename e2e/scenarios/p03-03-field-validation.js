import { PLACES } from '../../server/seed/data/places.js'
import { clickText, setValue, signInWithForm, waitForText } from '../lib/flows.js'
import { onboardedCandidate } from '../lib/candidates.js'
import { api, TEST_PASSWORD } from '../lib/testApi.js'

const BASICS = {
  fullName: 'Field Rules',
  headline: 'Designer',
  placeId: PLACES.london.placeId,
  about: 'I design calm, accessible products.',
  yearsExperience: 3,
  skills: ['Figma'],
  workPreference: 'remote',
  availability: 'available_now',
}

/** Adds a skill through the draft field. */
async function addSkill(page, skill) {
  await page.type('input[name="skillDraft"]', skill)
  await page.keyboard.press('Enter')
}

/**
 * P3-03 (§3.2, M-022, M-064): headline 61, about 19, a 13th skill, a duplicate skill in another case, a
 * non-linkedin.com/in URL, an http portfolio and an end month before the start show translated messages;
 * the same payloads through the API answer 422.
 */
export default {
  name: 'P3-03 Field validation',
  viewports: ['D', 'M'],
  async run(ctx) {
    const { email, token } = await onboardedCandidate('Rules')
    const handle = await ctx.newPage()
    const { page } = handle
    await signInWithForm(page, ctx.webUrl, '/sign-in', email, TEST_PASSWORD)
    await page.goto(`${ctx.webUrl}/candidate/profile`, { waitUntil: 'networkidle0' })

    await clickText(page, 'Edit profile', 'button')
    await page.waitForSelector('input[name="headline"]')
    await page.type('input[name="headline"]', 'x'.repeat(61))
    await page.type('textarea[name="about"]', 'x'.repeat(19))
    await page.type('input[name="yearsExperience"]', '3')
    await addSkill(page, 'Figma')
    await addSkill(page, 'figma')
    await waitForText(page, 'figma is already in your skills.')
    await setValue(page, 'input[name="skillDraft"]', '')
    for (let i = 2; i <= 12; i++) await addSkill(page, `Skill ${i}`)
    await addSkill(page, 'Skill 13')
    await waitForText(page, 'Add at most 12.')
    await setValue(page, 'input[name="skillDraft"]', '')
    await clickText(page, 'Save', '[role="dialog"] button')
    await waitForText(page, 'Use at most 60 characters.')
    await waitForText(page, 'Tell your story in at least 20 characters.')
    await handle.checkOverflow()
    await ctx.screenshot(page, '1-core-rules')
    await clickText(page, 'Cancel', '[role="dialog"] button')
    await page.waitForFunction(() => !document.querySelector('[role="dialog"]'))

    await clickText(page, 'Edit links', 'button')
    await page.waitForSelector('input[name="linkedin"]')
    await page.type('input[name="linkedin"]', 'https://linkedin.com/company/acme')
    await page.type('input[name="portfolio"]', 'http://rules.example.com')
    await clickText(page, 'Save', '[role="dialog"] button')
    await waitForText(page, 'Use a LinkedIn profile link, like https://www.linkedin.com/in/your-name.')
    await waitForText(page, 'Use a full link that starts with https://.')
    await ctx.screenshot(page, '2-links')
    await clickText(page, 'Cancel', '[role="dialog"] button')
    await page.waitForFunction(() => !document.querySelector('[role="dialog"]'))

    await clickText(page, 'Add a role', 'button')
    await page.waitForSelector('input[name="title"]')
    await page.type('input[name="title"]', 'Designer')
    await page.type('input[name="employer"]', 'Studio')
    await setValue(page, 'input[name="start"]', '2022-05')
    await setValue(page, 'input[name="end"]', '2021-01')
    await clickText(page, 'Save', '[role="dialog"] button')
    await waitForText(page, 'Choose an end date after the start date.')
    await ctx.screenshot(page, '3-dates')
    ctx.assertClean(handle.issues, 'field rules')

    const expect422 = async (path, method, body, field) => {
      const res = await api(path, { method, token, body })
      ctx.check(res.status === 422 && res.body.error.fields?.[field], `${method} ${path} → 422 on ${field} (got ${res.status} ${JSON.stringify(res.body?.error)})`)
    }
    await expect422('/candidate/profile', 'PUT', { ...BASICS, headline: 'x'.repeat(61) }, 'headline')
    await expect422('/candidate/profile', 'PUT', { ...BASICS, about: 'x'.repeat(19) }, 'about')
    await expect422('/candidate/profile', 'PUT', { ...BASICS, skills: Array.from({ length: 13 }, (_, i) => `Skill ${i}`) }, 'skills')
    await expect422('/candidate/profile', 'PUT', { ...BASICS, skills: ['Figma', 'FIGMA'] }, 'skills')
    await expect422('/candidate/profile/links', 'PUT', { linkedin: 'https://linkedin.com/company/acme' }, 'linkedin')
    await expect422('/candidate/profile/links', 'PUT', { portfolio: 'http://rules.example.com' }, 'portfolio')
    await expect422('/candidate/profile/work-history', 'POST', { title: 'Designer', employer: 'Studio', start: '2022-05', end: '2021-01' }, 'end')
  },
}
