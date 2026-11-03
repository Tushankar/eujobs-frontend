import { fixture } from '../fixtures/make.js'
import { onboardedCandidate } from '../lib/candidates.js'
import { chooseFile, clickText, fill, pageApi, signInWithForm, toggleCheckbox, waitForPath, waitForText } from '../lib/flows.js'
import { PRICES_19 } from '../lib/learning.js'
import { api } from '../lib/testApi.js'

const dialog = '[role="dialog"]'

/** Opens "Add lesson", sets the title and type, and returns once the dialog shows the type's fields. */
async function startLesson(page, title, type) {
  await page.click('[data-add-lesson]')
  await page.waitForSelector(`${dialog} [data-lesson-form]`, { visible: true })
  await fill(page, `${dialog} input[name="title"]`, title)
  await page.select(`${dialog} select[name="type"]`, type)
}

async function saveLesson(page, count) {
  await page.click(`${dialog} [data-save-lesson]`)
  await page.waitForFunction((n) => !document.querySelector('[role="dialog"]') && document.querySelectorAll('[data-lesson-item]').length === n, { timeout: 15_000 }, count)
}

/** Opens a builder tab and waits until it is the selected one. */
async function openTab(page, name) {
  await clickText(page, name, 'main [role="tab"]')
  await page.waitForFunction((wanted) => document.querySelector('main [role="tab"][aria-selected="true"]')?.textContent === wanted, { timeout: 10_000 }, name)
}

const lessonTitles = (page) => page.$$eval('[data-lesson-item]', (items) => items.map((item) => item.querySelector('p').textContent.replace(/^\d+\.\s*/, '')))

/**
 * P8-01 (M-101, M-102, M-104, M-106, U16, U24): the Owner builds a candidate course through the full-page builder:
 * all Details fields and a JPG cover; publishing is blocked while HUF is missing; MP4 upload with progress and the
 * duration read by the browser; Markdown sanitised in the preview; http links refused; a PDF and a link lesson;
 * the first lesson a free preview; reorder by keyboard and by drag; quiz rules; publish; listed for candidates.
 */
export default {
  name: 'P8-01 Builder',
  viewports: ['D', 'M'],
  async run(ctx) {
    const handle = await ctx.newPage()
    const { page } = handle
    handle.allow(422, '/api/v1/admin/courses/')
    await signInWithForm(page, ctx.webUrl, '/admin/sign-in', ctx.seedCredentials.email(), ctx.seedCredentials.password)
    await page.goto(`${ctx.webUrl}/admin/courses`, { waitUntil: 'networkidle0' })
    await clickText(page, 'New course', 'main a')
    await waitForPath(page, '/admin/courses/new')
    const title = `Builder check ${ctx.viewport} ${Date.now()}`
    await fill(page, 'main form input', title)
    await clickText(page, 'Create draft', 'main button')
    await waitForPath(page, () => /^\/admin\/courses\/[a-f\d]{24}\/edit$/.test(location.pathname))
    const courseId = page.url().split('/').at(-2)

    // Details: every learner field, a JPG cover, 7 of the 8 prices.
    await fill(page, 'input[name="category"]', 'Interaction Design')
    await page.select('select[name="level"]', 'foundation')
    await fill(page, 'textarea[name="summary"]', 'Build clear flows and useful states through one practical exercise.')
    await fill(page, 'textarea[name="about"]', 'Prototype one flow end to end, with keyboard use, empty states and helpful errors.')
    await fill(page, 'input[aria-label="Outcome 1"]', 'Map a flow from the first screen to the goal.')
    await fill(page, 'input[name="skillTags"]', 'Interaction Design, Prototyping')
    for (const [currency, amount] of Object.entries(PRICES_19)) if (currency !== 'HUF') await fill(page, `input[data-price="${currency}"]`, String(amount))
    await page.click('[data-save-details]')
    await waitForText(page, 'Saved')
    await chooseFile(page, '[data-upload="course_cover"] input[type="file"]', fixture('cover.jpg'))
    await page.waitForSelector('[data-cover-preview]', { visible: true })
    await ctx.screenshot(page, '1-details')

    // U24: publishing is blocked, with the reason.
    // The checklist is always shown on a draft, so wait for the refused publish itself.
    const refused = page.waitForResponse((response) => response.url().endsWith(`/admin/courses/${courseId}/status`))
    await page.click('[data-publish]')
    ctx.check((await refused).status() === 422, 'the publish request is refused with 422')
    await page.waitForFunction(() => document.querySelector('[data-publish-problems]')?.innerText.includes('Add the HUF price'), { timeout: 10_000 })
    const problems = await page.$eval('[data-publish-problems]', (element) => element.innerText)
    ctx.check(problems.includes('Add at least one lesson') && problems.includes('Add at least one quiz question'), `the reasons name lessons and quiz too:\n${problems}`)
    ctx.check((await page.$eval('[data-course-status]', (element) => element.dataset.courseStatus)) === 'draft', 'the course stays a draft')
    await ctx.screenshot(page, '2-publish-blocked')

    // Lessons: MP4 with progress and the browser-read duration (editable).
    await openTab(page, 'Lessons')
    await startLesson(page, 'Course introduction', 'video')
    await page.evaluate(() => {
      window.__sawProgress = false
      new MutationObserver(() => {
        if (document.querySelector('[data-upload-progress]')) window.__sawProgress = true
      }).observe(document.body, { childList: true, subtree: true })
    })
    await chooseFile(page, `${dialog} [data-upload="lesson_video"] input[type="file"]`, fixture('lesson.mp4'))
    await page.waitForSelector(`${dialog} [data-upload-current]`, { visible: true, timeout: 30_000 })
    await page.waitForFunction(() => document.querySelector('[role="dialog"] input[name="durationSec"]').value !== '', { timeout: 15_000 })
    const duration = await page.$eval(`${dialog} input[name="durationSec"]`, (element) => element.value)
    ctx.check(await page.evaluate(() => window.__sawProgress), 'the upload showed its progress bar')
    ctx.check(['29', '30'].includes(duration), `the duration was read from the video (${duration} s)`)
    await fill(page, `${dialog} input[name="durationSec"]`, '31')
    await page.waitForSelector(`${dialog} [data-video-preview]`, { visible: true })
    await ctx.screenshot(page, '3-video-lesson')
    await saveLesson(page, 1)

    // Text: <script> and a javascript: link are removed in the server preview.
    await startLesson(page, 'Reading: useful states', 'text')
    await fill(page, `${dialog} textarea[name="textMarkdown"]`, '<script>alert(1)</script>\n\n## States\n\nRead [this](javascript:alert(2)) and [the guide](https://example.org/guide).')
    await page.click(`${dialog} [data-markdown-preview]`)
    await page.waitForSelector(`${dialog} [data-markdown-html]`, { visible: true })
    const html = await page.$eval(`${dialog} [data-markdown-html]`, (element) => element.innerHTML)
    ctx.check(!/<script|href="javascript/i.test(html) && html.includes('href="https://example.org/guide"') && html.includes('<h2>States</h2>'), `the preview is sanitised: ${html}`)
    await ctx.screenshot(page, '4-markdown-preview')
    await saveLesson(page, 2)

    // Link: http is refused, https saves.
    await startLesson(page, 'Further reading', 'link')
    await fill(page, `${dialog} input[name="url"]`, 'http://example.org/guide')
    await page.click(`${dialog} [data-save-lesson]`)
    await page.waitForFunction(() => document.querySelector('[role="dialog"] input[name="url"]')?.getAttribute('aria-invalid') === 'true', { timeout: 10_000 })
    await ctx.screenshot(page, '5-http-refused')
    await fill(page, `${dialog} input[name="url"]`, 'https://example.org/guide')
    await saveLesson(page, 3)

    // A PDF lesson.
    await startLesson(page, 'Worksheet', 'document')
    await chooseFile(page, `${dialog} [data-upload="lesson_document"] input[type="file"]`, fixture('worksheet.pdf'))
    await page.waitForSelector(`${dialog} [data-upload-current]`, { visible: true })
    await saveLesson(page, 4)

    // The first lesson becomes a free preview.
    await page.click('[data-lesson-item]:first-child button[aria-label^="Edit"]')
    await page.waitForSelector(`${dialog} [data-lesson-form]`, { visible: true })
    await toggleCheckbox(page, 'isPreview')
    await saveLesson(page, 4)
    await page.waitForFunction(() => document.querySelector('[data-lesson-item]:first-child').innerText.includes('Free preview'))

    // Reorder with the keyboard, then by dragging.
    await page.focus('[data-lesson-item]:first-child [data-move="down"]')
    await page.keyboard.press('Enter')
    await page.waitForFunction(() => document.querySelector('[data-lesson-item]:first-child').innerText.includes('Reading: useful states'))
    await page.evaluate(() => {
      const items = document.querySelectorAll('[data-lesson-item]')
      const transfer = new DataTransfer()
      items[3].dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: transfer }))
      items[0].dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: transfer }))
      items[0].dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }))
    })
    await page.waitForFunction(() => document.querySelector('[data-lesson-item]:first-child').innerText.includes('Worksheet'))
    const order = (await pageApi(page, `/admin/courses/${courseId}`)).body.lessons.map((lesson) => lesson.title)
    ctx.check(order.join('|') === 'Worksheet|Reading: useful states|Course introduction|Further reading', `the server keeps the new order (${order.join(', ')})`)
    ctx.check((await lessonTitles(page)).join('|') === order.join('|'), 'the list shows the saved order')
    await ctx.screenshot(page, '6-lessons')

    // Quiz: one option → error; no correct option → error; then 5 valid questions.
    await openTab(page, 'Quiz')
    await page.click('[data-add-question]')
    // The question field is the one input of a question without an aria-label (it has a visible label).
    await fill(page, '[data-question="0"] input:not([aria-label])', 'Which state helps a first-time user?')
    await fill(page, '[data-question="0"] input[aria-label="Option 1"]', 'An empty state with a next step')
    await page.click('[data-question="0"] button[aria-label="Remove option 2"]')
    await page.click('[data-save-quiz]')
    await page.waitForSelector('[data-question="0"] [data-question-error]', { visible: true })
    await ctx.screenshot(page, '7-one-option')
    await clickText(page, 'Add option', '[data-question="0"] button')
    await fill(page, '[data-question="0"] input[aria-label="Option 2"]', 'A loading spinner')
    await page.click('[data-save-quiz]')
    await page.waitForFunction(() => document.querySelector('[data-question="0"] [data-question-error]')?.innerText.trim().length > 0)
    ctx.check((await page.$$('[data-question="0"] [data-question-error]')).length === 1, 'a question without a correct option is refused')
    await page.click('[data-question="0"] [data-correct="0"]')
    const questions = [
      ['single', 'What should a flow map start from?', ['The user’s goal', 'The colour palette', 'The logo'], [0]],
      ['multiple', 'Which are states of a list screen?', ['Empty', 'Loading', 'Font size'], [0, 1]],
      ['single', 'Where do keyboard users need focus?', ['On the next control', 'Nowhere', 'On the footer'], [0]],
      ['multiple', 'Which make an error helpful?', ['It names the problem', 'It says how to fix it', 'It blames the user'], [0, 1]],
    ]
    for (const [index, [type, text, options, correct]] of questions.entries()) {
      const at = `[data-question="${index + 1}"]`
      await page.click('[data-add-question]')
      await page.waitForSelector(at)
      await fill(page, `${at} input:not([aria-label])`, text)
      await page.select(`${at} select`, type)
      await clickText(page, 'Add option', `${at} button`)
      for (const [optionIndex, option] of options.entries()) await fill(page, `${at} input[aria-label="Option ${optionIndex + 1}"]`, option)
      for (const optionIndex of correct) await page.click(`${at} [data-correct="${optionIndex}"]`)
    }
    await page.click('[data-save-quiz]')
    await waitForText(page, 'Saved')
    const quiz = (await pageApi(page, `/admin/courses/${courseId}`)).body.quiz
    ctx.check(quiz.questions.length === 5 && quiz.questions[2].type === 'multiple' && quiz.questions[2].correct.join() === '0,1', `5 questions saved, single and multiple (${JSON.stringify(quiz.questions.map((question) => question.correct))})`)
    await ctx.screenshot(page, '8-quiz')

    // The HUF price, then publish.
    await openTab(page, 'Details')
    await fill(page, 'input[data-price="HUF"]', String(PRICES_19.HUF))
    await page.click('[data-save-details]')
    await waitForText(page, 'Saved')
    await page.click('[data-publish]')
    await page.waitForSelector('[data-course-status="published"]', { timeout: 10_000 })
    await openTab(page, 'Preview')
    await page.waitForSelector('[data-course-preview]', { visible: true })
    await ctx.screenshot(page, '9-published-preview')
    ctx.assertClean(handle.issues, 'builder')

    const candidate = await onboardedCandidate(`builder-${ctx.viewport}`)
    const catalogue = await api('/courses', { token: candidate.token })
    ctx.check(catalogue.body.items.some((course) => course.id === courseId && course.title === title), 'the course is listed in the candidate catalogue')
  },
}
