import { applyApi, chooseStage, completeCandidate, recruiterWithJob } from '../lib/applicants.js'
import { clickText, pageApi, signInWithForm, waitForText } from '../lib/flows.js'
import { TEST_PASSWORD } from '../lib/testApi.js'

/** HTML5 drag and drop from `from` onto `to`, as the browser fires it (Puppeteer's mouse does not start a native drag). */
const dragOnto = (page, from, to) =>
  page.evaluate(
    (source, target) => {
      const transfer = new DataTransfer()
      const fire = (element, type) => element.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: transfer }))
      const row = document.querySelector(source)
      const stage = document.querySelector(target)
      fire(row, 'dragstart')
      fire(stage, 'dragenter')
      fire(stage, 'dragover')
      fire(stage, 'drop')
      fire(row, 'dragend')
    },
    from,
    to,
  )

/** The funnel numbers per stage as the page shows them: name → [now, reached]. */
const funnelNumbers = (page) =>
  page.$$eval('[data-funnel-stage]', (stages) => Object.fromEntries(stages.map((stage) => [stage.dataset.funnelStage, [Number(stage.dataset.now), Number(stage.dataset.reached)]])))

const stageOf = async (page, id) => (await pageApi(page, '/recruiter/applications')).body.items.find((item) => item.id === id)?.stage.name

/**
 * Hiring pipeline Funnel view and candidate notes (owner decisions 2026-11-05): one funnel stage per company stage with
 * "now" and "reached"; dragging a row onto a stage and the row's stage menu both move the application; the candidate
 * panel (shared by Board and Funnel) shows the dated stage history and adds a note with its date, time, stage and job;
 * the board card then shows the note count and opens the same panel.
 */
export default {
  name: 'P6-10 Funnel and notes',
  viewports: ['D', 'M'],
  async run(ctx) {
    const { recruiter, job } = await recruiterWithJob('Funnel')
    const [ana, ben] = await Promise.all([completeCandidate('FunnelAna'), completeCandidate('FunnelBen')])
    const { body: first } = await applyApi(ana.token, job.id)
    const { body: second } = await applyApi(ben.token, job.id)

    const handle = await ctx.newPage()
    const { page } = handle
    await signInWithForm(page, ctx.webUrl, '/recruiter/sign-in', recruiter.email, TEST_PASSWORD)
    await page.goto(`${ctx.webUrl}/recruiter/hiring-pipeline`, { waitUntil: 'networkidle0' })
    await clickText(page, 'Funnel view', 'button')
    await page.waitForSelector('[data-funnel-stage="Applied"]')
    ctx.check(new URL(page.url()).pathname === '/recruiter/hiring-pipeline/funnel', 'the Funnel view has its own URL')
    let numbers = await funnelNumbers(page)
    ctx.check(JSON.stringify(numbers.Applied) === '[2,2]' && JSON.stringify(numbers.Interview) === '[0,0]', `Applied 2 now / 2 reached (${JSON.stringify(numbers)})`)
    await page.waitForSelector(`[data-funnel-list="Applied"] [data-application="${first.id}"]`)
    await handle.checkOverflow()
    await ctx.screenshot(page, '1-funnel')

    // Move by dragging a row onto the Interview stage (desktop), and with the row's stage menu.
    if (ctx.viewport === 'D') {
      await dragOnto(page, `[data-funnel-list] [data-application="${first.id}"]`, '[data-funnel-stage="Interview"]')
    } else {
      await chooseStage(page, `[data-funnel-list] [data-stage-select="${first.id}"] select`, 'Interview')
    }
    await page.waitForFunction(() => document.querySelector('[data-funnel-stage="Interview"]')?.dataset.now === '1')
    ctx.check((await stageOf(page, first.id)) === 'Interview', 'the move reached the server')
    await chooseStage(page, `[data-funnel-list] [data-stage-select="${second.id}"] select`, 'Screening')
    await page.waitForFunction(() => document.querySelector('[data-funnel-stage="Screening"]')?.dataset.now === '1')
    numbers = await funnelNumbers(page)
    ctx.check(JSON.stringify([numbers.Applied, numbers.Screening, numbers.Interview]) === '[[0,2],[1,1],[1,1]]', `now and reached after the moves (${JSON.stringify(numbers)})`)

    // The candidate panel from the funnel: dated history, then a note with its date, time, stage and job.
    await page.click('[data-funnel-stage="Interview"]')
    await page.waitForSelector(`[data-funnel-list="Interview"] [data-application="${first.id}"]`)
    await page.click(`[data-funnel-list="Interview"] [data-application="${first.id}"] button`)
    await page.waitForSelector(`[data-applicant-panel="${first.id}"]`)
    ctx.check(new URL(page.url()).searchParams.get('application') === first.id, 'the open panel is in the URL')
    const history = await page.$$eval(`[data-applicant-panel] ol time`, (times) => times.length)
    ctx.check(history === 2, `two dated stage steps: Interview and Applied (got ${history})`)
    await page.type('[data-applicant-panel] textarea[name="note"]', 'Strong portfolio; ask about design systems.')
    await clickText(page, 'Add note', '[data-applicant-panel] button')
    await page.waitForSelector('[data-applicant-panel] [data-note] time[datetime]')
    const note = await page.$eval('[data-applicant-panel] [data-note]', (element) => element.innerText)
    ctx.check(note.includes(`Interview · ${job.title}`) && note.includes('Strong portfolio; ask about design systems.'), `the note keeps its stage and job (${note})`)
    ctx.check(/\d{1,2}:\d{2}/.test(note), `the note shows its time (${note})`)
    await handle.checkOverflow()
    await ctx.screenshot(page, '2-panel-note')
    await page.keyboard.press('Escape')
    await page.waitForFunction(() => !document.querySelector('[data-applicant-panel]'))

    // The board shows the note count and opens the same panel with the same note.
    await clickText(page, 'Board view', 'button')
    await page.waitForSelector(`[data-application="${first.id}"] [data-note-count="1"]`)
    await page.click(`[data-application="${first.id}"] [data-note-count]`)
    await page.waitForSelector(`[data-applicant-panel="${first.id}"] [data-note]`)
    await waitForText(page, 'Strong portfolio; ask about design systems.')
    await ctx.screenshot(page, '3-board-panel')
    ctx.assertClean(handle.issues, 'funnel and notes')
  },
}
