import { onboardedCandidate } from '../lib/candidates.js'
import { waitForText } from '../lib/flows.js'
import { enrolFree, openLessons, publishedCourse } from '../lib/learning.js'
import { openAs } from '../lib/payments.js'
import { ownerToken } from '../lib/recruiters.js'
import { api, mailTo } from '../lib/testApi.js'

const option = (text) => ({ text })
const QUESTIONS = [
  { text: 'Which state helps a first-time user?', type: 'single', options: ['An empty state with a next step', 'A spinner', 'A blank page', 'An error code'].map(option), correct: [0] },
  { text: 'Which are states of a list screen?', type: 'multiple', options: ['Empty', 'Loading', 'Font size', 'Logo'].map(option), correct: [0, 1] },
  { text: 'Where should focus go after closing a dialog?', type: 'single', options: ['Back to the control that opened it', 'The footer', 'Nowhere', 'The browser bar'].map(option), correct: [0] },
  { text: 'Which make an error message helpful?', type: 'multiple', options: ['It names the problem', 'It says how to fix it', 'It blames the user', 'It hides the field'].map(option), correct: [0, 1] },
  { text: 'What should a flow map start from?', type: 'single', options: ['The user’s goal', 'The colour palette', 'The logo', 'The footer'].map(option), correct: [0] },
]
const isRight = (text) => QUESTIONS.some((question) => question.correct.some((index) => question.options[index].text === text))

// New blocks enter with the page's rise animation (about 0.4 s); screenshots wait for it.
const settle = () => new Promise((resolve) => setTimeout(resolve, 600))

const optionOrder = (page, index) => page.$$eval(`[data-quiz-question="${index}"] label span`, (spans) => spans.map((span) => span.textContent).join('|'))

/** Ticks the options of every question: the right ones, or for `wrong` the first wrong one. */
async function answer(page, { wrong = false } = {}) {
  const labels = await page.$$('[data-quiz-form] label')
  const chosen = new Set()
  for (const label of labels) {
    const [text, question] = await label.evaluate((element) => [element.querySelector('span').textContent, element.closest('[data-quiz-question]').dataset.quizQuestion])
    const pick = wrong ? !isRight(text) && !chosen.has(question) : isRight(text)
    if (pick) {
      chosen.add(question)
      await label.click()
    }
  }
}

/**
 * P8-06 (M-104, M-105, M-110): the quiz is locked until every lesson is complete; a wrong submission shows the score
 * without the correct answers; a retry reshuffles the options; a pass (≥ 70) issues the certificate and its email;
 * the best score is kept.
 */
export default {
  name: 'P8-06 Quiz',
  viewports: ['D', 'M'],
  async run(ctx) {
    const course = await publishedCourse(await ownerToken(), { title: `Quiz ${ctx.viewport} ${Date.now()}`, isFree: true, questions: QUESTIONS })
    const learner = await onboardedCandidate(`Quiz${ctx.viewport}`)
    await enrolFree(learner.token, course.id)
    const handle = await ctx.newPage()
    const { page } = handle
    const quizPath = `/candidate/learning/${course.id}/quiz`

    await openAs(ctx, handle, learner.email, quizPath)
    await waitForText(page, 'Finish every lesson first')
    await ctx.screenshot(page, '1-locked')
    await openLessons(learner.token, course)

    await page.goto(`${ctx.webUrl}/candidate/learning/${course.id}`, { waitUntil: 'networkidle0' })
    await page.click('[data-quiz-card="open"] [data-take-quiz]')
    await page.waitForSelector('[data-quiz-form]', { visible: true })
    const firstOrder = await optionOrder(page, 0)
    await answer(page, { wrong: true })
    await page.click('[data-quiz-submit]')
    await page.waitForSelector('[data-quiz-result="failed"]', { visible: true })
    const failed = await page.$eval('[data-quiz-result]', (element) => element.innerText)
    ctx.check(/0\s?%/.test(failed) && failed.includes('Not passed yet') && failed.includes('70'), `a wrong submission shows its score (${failed.replace(/\s+/g, ' ')})`)
    ctx.check(!(await page.$('[data-quiz-form]')) && !QUESTIONS.some((question) => failed.includes(question.options[question.correct[0]].text)), 'no correct answer is revealed')
    await settle()
    await ctx.screenshot(page, '2-failed')

    // A retry draws a new order (24 orders per question; up to three tries).
    await page.click('[data-quiz-retry]')
    await page.waitForSelector('[data-quiz-form]', { visible: true })
    let reshuffled = (await optionOrder(page, 0)) !== firstOrder
    for (let attempt = 0; attempt < 3 && !reshuffled; attempt++) {
      await page.reload({ waitUntil: 'networkidle0' })
      await page.waitForSelector('[data-quiz-form]', { visible: true })
      reshuffled = (await optionOrder(page, 0)) !== firstOrder
    }
    ctx.check(reshuffled, 'the options are reshuffled on retry')

    await answer(page)
    await page.click('[data-quiz-submit]')
    await page.waitForSelector('[data-quiz-result="passed"]', { visible: true })
    await page.waitForSelector('[data-certificate-code]', { visible: true })
    const code = await page.$eval('[data-certificate-code]', (element) => element.textContent.trim())
    ctx.check(/^LWM-[A-Z\d]{4}-[A-Z\d]{4}$/.test(code), `a certificate is issued (${code})`)
    await settle()
    await ctx.screenshot(page, '3-passed')
    const [mail] = await mailTo(learner.email, 'certificate_issued')
    ctx.check(mail?.params.code === code, 'certificate_issued was sent with the code')

    // The best score stays after a worse attempt.
    await page.click('[data-quiz-retry]')
    await page.waitForSelector('[data-quiz-form]', { visible: true })
    await answer(page, { wrong: true })
    await page.click('[data-quiz-submit]')
    await page.waitForSelector('[data-quiz-result="failed"]', { visible: true })
    const enrollment = (await api('/learning/enrollments', { token: learner.token })).body.items.find((item) => item.courseId === course.id)
    ctx.check(enrollment.quizBestScore === 100 && enrollment.completedAt, `the best score is kept (${enrollment.quizBestScore})`)
    await page.goto(`${ctx.webUrl}/candidate/learning/${course.id}`, { waitUntil: 'networkidle0' })
    await page.waitForSelector(`[data-certificate="${code}"]`, { visible: true })
    await ctx.screenshot(page, '4-course-certificate')
    ctx.assertClean(handle.issues, 'quiz')
  },
}
