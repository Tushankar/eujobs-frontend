import { clickText, fill, signInWithForm, waitForText } from '../lib/flows.js'
import { freeCandidate } from '../lib/payments.js'
import { login, ownerToken } from '../lib/recruiters.js'
import { api, db } from '../lib/testApi.js'

const TITLE = 'Interaction systems in practice'

async function openTab(page, name) {
  await clickText(page, name, 'main [role="tab"]')
  await page.waitForFunction((wanted) => document.querySelector('main [role="tab"][aria-selected="true"]')?.textContent === wanted, {}, name)
}

/**
 * P8-08 (M-108, M-109): Emma bought "Interaction systems in practice" (seed), so its lessons and quiz are locked
 * with the reason shown, while copy and prices still save. Unpublished, it leaves the catalogue of others; Emma keeps
 * it and its lessons.
 */
export default {
  name: 'P8-08 Lock and unpublish',
  viewports: ['D'],
  async run(ctx) {
    const [course] = await db('courses', 'find', { filter: { title: TITLE } })
    const courseId = course._id.$oid ?? course._id
    const handle = await ctx.newPage()
    const { page } = handle
    await signInWithForm(page, ctx.webUrl, '/admin/sign-in', ctx.seedCredentials.email(), ctx.seedCredentials.password)
    await page.goto(`${ctx.webUrl}/admin/courses/${courseId}/edit`, { waitUntil: 'networkidle0' })
    await page.waitForSelector('[data-locked-notice]', { visible: true })
    ctx.check((await page.$eval('[data-locked-notice]', (element) => element.innerText)).includes('lessons and the quiz are locked'), 'the reason is shown')

    await openTab(page, 'Lessons')
    ctx.check(await page.$eval('[data-add-lesson]', (button) => button.disabled), 'Add lesson is disabled')
    ctx.check(await page.$$eval('[data-lesson-item] button', (buttons) => buttons.every((button) => button.disabled)), 'move, edit and delete are disabled')
    await ctx.screenshot(page, '1-lessons-locked')
    await openTab(page, 'Quiz')
    ctx.check(await page.$eval('[data-save-quiz]', (button) => button.disabled), 'Save quiz is disabled')
    await ctx.screenshot(page, '2-quiz-locked')

    // Copy and prices still save.
    await openTab(page, 'Details')
    const summary = 'Turn interaction patterns into one coherent system, now with a worked example.'
    await fill(page, 'textarea[name="summary"]', summary)
    await fill(page, 'input[data-price="EUR"]', '46')
    await page.click('[data-save-details]')
    await waitForText(page, 'Saved')
    const saved = (await api(`/admin/courses/${courseId}`, { token: await ownerToken() })).body
    ctx.check(saved.summary === summary && saved.prices.find((price) => price.currency === 'EUR').amountMinor === 4600, 'the summary and the EUR price saved')
    await ctx.screenshot(page, '3-copy-saved')

    await clickText(page, 'Unpublish', 'main button')
    await page.waitForSelector('[data-course-status="unpublished"]', { timeout: 10_000 })
    await ctx.screenshot(page, '4-unpublished')
    ctx.assertClean(handle.issues, 'lock and unpublish')

    const other = await freeCandidate('unpublished-other', 'GB')
    ctx.check(!(await api('/courses', { token: other.token })).body.items.some((item) => item.id === courseId), 'gone from another candidate’s catalogue')
    ctx.check((await api(`/courses/${courseId}`, { token: other.token })).status === 404, 'its page is gone for them')

    const emma = await ctx.newPage()
    await signInWithForm(emma.page, ctx.webUrl, '/sign-in', ctx.seedCredentials.email('emma'), ctx.seedCredentials.password)
    await emma.page.goto(`${ctx.webUrl}/candidate/learning`, { waitUntil: 'networkidle0' })
    await emma.page.waitForSelector(`[data-course-card="${courseId}"]`, { visible: true })
    await emma.page.goto(`${ctx.webUrl}/candidate/learning/${courseId}/lessons/${course.lessons[1]._id.$oid ?? course.lessons[1]._id}`, { waitUntil: 'networkidle0' })
    await emma.page.waitForSelector('[data-lesson-text]', { visible: true })
    await ctx.screenshot(emma.page, '5-buyer-keeps-access')
    const emmaToken = await login(ctx.seedCredentials.email('emma'), 'candidate', ctx.seedCredentials.password)
    ctx.check((await api('/courses', { token: emmaToken })).body.items.find((item) => item.id === courseId)?.status === 'unpublished', 'Emma still lists it')
    ctx.assertClean(emma.issues, 'buyer access')
  },
}
