// TEMPORARY (2026-11-17, phase 4): the four admin AI helpers with the real OpenAI, on seeded data.
import { openAsAdmin } from '../lib/admins.js'
import { clickText, fill, waitForText } from '../lib/flows.js'
import { ownerToken } from '../lib/recruiters.js'
import { api, db } from '../lib/testApi.js'

const AI_MS = 120_000
const ok = (result, label) => {
  if (result.status >= 300) throw new Error(`${label}: ${result.status} ${JSON.stringify(result.body)}`)
  return result.body
}

/** A draft course with the seeded "Evidence-led user interviews" lesson texts (or none). */
async function draftCourse(token, title, withText) {
  const course = ok(await api('/admin/courses', { method: 'POST', token, body: { audience: 'candidate', title } }), 'course')
  if (!withText) return course.id
  const [seeded] = await db('courses', 'find', { filter: { title: 'Evidence-led user interviews' } })
  for (const lesson of seeded.lessons.slice(0, 3)) {
    const added = ok(await api(`/admin/courses/${course.id}/lessons`, { method: 'POST', token, body: { title: lesson.title, type: 'text' } }), 'lesson')
    const lessonId = added.lessons.at(-1).id
    ok(await api(`/admin/courses/${course.id}/lessons/${lessonId}`, { method: 'PATCH', token, body: { textMarkdown: lesson.textMarkdown } }), 'lesson text')
  }
  return course.id
}

const openTab = (page, label) =>
  page.evaluate((text) => [...document.querySelectorAll('[role="tab"]')].find((tab) => tab.textContent.trim() === text).click(), label)

const intoView = (page, selector) => page.$eval(selector, (element) => element.scrollIntoView({ block: 'center' }))

export default {
  name: 'TMP Admin AI helpers',
  viewports: ['D', 'M'],
  async run(ctx) {
    const token = await ownerToken()
    const courseId = await draftCourse(token, `User interviews AI ${ctx.viewport}`, true)
    const emptyId = await draftCourse(token, `Empty course AI ${ctx.viewport}`, false)
    const handle = await ctx.newPage()
    const { page } = handle
    await openAsAdmin(ctx, handle, ctx.seedCredentials.email(null), `/admin/courses/${courseId}/edit`, ctx.seedCredentials.password)

    // 1. Details: fill with AI, then Undo.
    await page.waitForSelector('[data-course-details-ai]')
    await intoView(page, '[data-course-details-ai]')
    await ctx.screenshot(page, '1-details-before')
    await page.click('[data-course-details-ai]')
    await page.waitForFunction(() => document.querySelector('textarea[name="summary"]').value.length > 20, { timeout: AI_MS })
    await waitForText(page, 'Details filled in.')
    const details = await page.evaluate(() => ({
      summary: document.querySelector('textarea[name="summary"]').value,
      about: document.querySelector('textarea[name="about"]').value,
      outcomes: [...document.querySelectorAll('[data-outcome] textarea, textarea[data-outcome]')].map((element) => element.value),
      skillTags: document.querySelector('input[name="skillTags"]').value,
    }))
    ctx.note(`details summary: ${details.summary}`)
    ctx.note(`details outcomes: ${details.outcomes.join(' | ')}; tags: ${details.skillTags}`)
    ctx.check(details.about.length > 100 && details.outcomes.length >= 1 && details.skillTags, 'about, outcomes and tags filled')
    await intoView(page, '[data-course-details-ai]')
    await handle.checkOverflow()
    await ctx.screenshot(page, '2-details-filled')
    await clickText(page, 'Undo', '[data-details-form] button')
    await page.waitForFunction(() => document.querySelector('textarea[name="summary"]').value === '')
    // Undo autosaves the draft back as it was: wait for it so leaving the page saves nothing half-done.
    await page.waitForSelector('[data-autosave="saved"]', { timeout: 15_000 })

    // 2. Quiz: three questions appended, then saved through the usual Save.
    await openTab(page, 'Quiz')
    await page.waitForSelector('[data-quiz-ai] select')
    await page.select('[data-quiz-ai] select', '3')
    await page.click('[data-quiz-ai-run]')
    await page.waitForSelector('[data-quiz-ai-added]', { timeout: AI_MS })
    const questions = await page.$$eval('[data-question]', (panels) => panels.map((panel) => panel.querySelector('input').value))
    ctx.check(questions.length === 3, `three questions added (${questions.length})`)
    ctx.note(`quiz: ${questions.join(' | ')}`)
    await intoView(page, '[data-question="0"]')
    await handle.checkOverflow()
    await ctx.screenshot(page, '3-quiz-added')
    await intoView(page, '[data-quiz-ai]')
    await ctx.screenshot(page, '4-quiz-ai-panel')
    await page.click('[data-save-quiz]')
    await waitForText(page, 'Saved')
    const [saved] = await db('courses', 'find', { filter: { title: `User interviews AI ${ctx.viewport}` } })
    ctx.check(saved.quiz.questions.length === 3, 'the quiz saves with the suggested questions')

    // 3. A course without lesson text: a clear message.
    handle.allow(422, '/quiz-questions')
    await page.goto(`${ctx.webUrl}/admin/courses/${emptyId}/edit`, { waitUntil: 'networkidle0' })
    await page.waitForSelector('[role="tab"]')
    await openTab(page, 'Quiz')
    await page.waitForSelector('[data-quiz-ai-run]')
    await page.click('[data-quiz-ai-run]')
    await page.waitForSelector('[data-quiz-ai-state="no-text"]', { timeout: 30_000 })
    await ctx.screenshot(page, '5-quiz-no-text')

    // 4. Report triage on the seeded job case.
    const [jobCase] = await db('moderationcases', 'find', { filter: { targetType: 'job', status: 'open' } })
    await page.goto(`${ctx.webUrl}/admin/moderation/content/${jobCase._id.$oid}`, { waitUntil: 'networkidle0' })
    await page.waitForSelector('[data-ai-triage-run]')
    await intoView(page, '[data-ai-triage]')
    await ctx.screenshot(page, '6-triage-before')
    await page.click('[data-ai-triage-run]')
    await page.waitForSelector('[data-ai-triage-result]', { timeout: AI_MS })
    ctx.note(`triage: ${(await page.$eval('[data-ai-triage]', (element) => element.innerText)).replace(/\s+/g, ' ')}`)
    await waitForText(page, 'Suggestion — you decide')
    await intoView(page, '[data-ai-triage]')
    await handle.checkOverflow()
    await ctx.screenshot(page, '7-triage')

    // 5. Account review summary for the seeded applicant.
    const [james] = await db('users', 'find', { filter: { email: ctx.seedCredentials.email('james') } })
    await page.goto(`${ctx.webUrl}/admin/moderation/accounts/${james._id.$oid}`, { waitUntil: 'networkidle0' })
    await page.waitForSelector('[data-ai-account-summary-run]')
    await page.click('[data-ai-account-summary-run]')
    await page.waitForSelector('[data-ai-account-summary-result]', { timeout: AI_MS })
    ctx.note(`account: ${(await page.$eval('[data-ai-account-summary]', (element) => element.innerText)).replace(/\s+/g, ' ')}`)
    await intoView(page, '[data-ai-account-summary]')
    await handle.checkOverflow()
    await ctx.screenshot(page, '8-account-summary')

    // 6. Blog: an article and summary from a title and points; not saved.
    await page.goto(`${ctx.webUrl}/admin/website/blog/new`, { waitUntil: 'networkidle0' })
    await fill(page, 'input[name="title"]', 'Writing a CV that works across Europe')
    await fill(page, 'textarea[name="aiPoints"]', 'Keep it to one or two pages\nList the languages you speak with a level\nSay where you may work\nLead with recent, relevant experience')
    await page.click('[data-blog-ai-run]')
    await page.waitForFunction(() => document.querySelector('textarea[name="bodyMarkdown"]').value.length > 400, { timeout: AI_MS })
    const blog = await page.evaluate(() => ({ excerpt: document.querySelector('textarea[name="excerpt"]').value, body: document.querySelector('textarea[name="bodyMarkdown"]').value }))
    ctx.note(`blog excerpt: ${blog.excerpt}`)
    ctx.note(`blog body start: ${blog.body.slice(0, 300).replace(/\n/g, ' / ')}`)
    ctx.check(/^#|\n## /.test(blog.body), 'the body is Markdown with headings')
    await intoView(page, '[data-blog-ai]')
    await handle.checkOverflow()
    await ctx.screenshot(page, '9-blog-draft')

    ctx.assertClean(handle.issues, 'admin AI helpers')
  },
}
