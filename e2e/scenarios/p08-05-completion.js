import { onboardedCandidate } from '../lib/candidates.js'
import { enrolFree, publishedCourse } from '../lib/learning.js'
import { openAs } from '../lib/payments.js'
import { ownerToken } from '../lib/recruiters.js'
import { db } from '../lib/testApi.js'

const LESSONS = [
  { title: 'Reading: useful states', type: 'text', textMarkdown: '## States\n\nEmpty, loading and error states.' },
  { title: 'Worksheet', type: 'document', file: 'worksheet.pdf' },
  { title: 'Further reading', type: 'link', url: 'https://example.org/guide' },
  { title: 'Intro video', type: 'video', file: 'lesson.mp4', durationSec: 30, contentLanguage: 'en' },
]

const lessonPath = (course, index) => `/candidate/learning/${course.id}/lessons/${course.lessons[index].id}`
const isDone = (page) => page.$('[data-lesson-done]').then(Boolean)

/** The video lesson's credited seconds and completion, from the test database. */
async function videoProgress(email, course) {
  const [user] = await db('users', 'find', { filter: { email } })
  const [enrollment] = await db('enrollments', 'find', { filter: { userId: user._id } })
  const entry = enrollment.lessons.find((item) => (item.lessonId.$oid ?? item.lessonId) === course.lessons[3].id)
  return { credited: entry?.creditedSec ?? 0, done: Boolean(entry?.completedAt) }
}

/** Plays the lesson video muted (autoplay allows it) at `rate`; `seekTo` jumps there right after it starts. */
async function play(page, { rate = 1, seekTo } = {}) {
  await page.waitForSelector('[data-lesson-video]')
  await page.$eval(
    '[data-lesson-video]',
    async (video, playbackRate, target) => {
      video.muted = true
      video.playbackRate = playbackRate
      await video.play()
      if (target !== null) video.currentTime = target
    },
    rate,
    seekTo ?? null,
  )
  await page.waitForFunction(() => document.querySelector('[data-lesson-video]').ended, { timeout: 60_000 })
  // The ended heartbeat is in flight; give it a moment to land.
  await new Promise((resolve) => setTimeout(resolve, 1500))
}

/**
 * P8-05 (M-099, M-103, U15): a text lesson completes when opened, a PDF when opened, a link on click-through. The
 * ~30 s video played at 1× completes at the end (90 % credited); jumping to the end earns nothing; at 2× it
 * completes in about 15 s; at 4× nothing counts (credit at most 2×).
 */
export default {
  name: 'P8-05 Completion',
  viewports: ['D', 'M'],
  async run(ctx) {
    const course = await publishedCourse(await ownerToken(), { title: `Completion ${ctx.viewport} ${Date.now()}`, isFree: true, lessons: LESSONS })
    const learners = await Promise.all(['Normal', 'Seeker', 'Double', 'Fast'].map(async (label) => {
      const learner = await onboardedCandidate(`${label}${ctx.viewport}`)
      await enrolFree(learner.token, course.id)
      return learner
    }))
    const [normal, seeker, double, fast] = learners

    const handle = await ctx.newPage()
    const { page } = handle
    await openAs(ctx, handle, normal.email, lessonPath(course, 0))
    await page.waitForSelector('[data-lesson-done]', { visible: true })
    await ctx.screenshot(page, '1-text-done')
    await page.goto(`${ctx.webUrl}${lessonPath(course, 1)}`, { waitUntil: 'networkidle0' })
    await page.waitForSelector('[data-lesson-done]', { visible: true })
    await page.goto(`${ctx.webUrl}${lessonPath(course, 2)}`, { waitUntil: 'networkidle0' })
    await page.waitForSelector('[data-lesson-link]')
    ctx.check(!(await isDone(page)), 'a link lesson is not complete before the click-through')
    const popup = new Promise((resolve) => page.browser().once('targetcreated', (target) => resolve(target.page())))
    await page.click('[data-lesson-link]')
    await (await popup)?.close()
    await page.waitForSelector('[data-lesson-done]', { visible: true })
    await ctx.screenshot(page, '2-link-done')

    await page.goto(`${ctx.webUrl}${lessonPath(course, 3)}`, { waitUntil: 'networkidle0' })
    ctx.check(!(await isDone(page)), 'the video is not complete when opened')
    await play(page)
    const watched = await videoProgress(normal.email, course)
    ctx.check(watched.done && watched.credited >= 27, `1×: complete after watching (${watched.credited} s credited)`)
    await page.waitForSelector('[data-lesson-done]', { visible: true })
    await ctx.screenshot(page, '3-video-done')
    ctx.assertClean(handle.issues, 'completion')

    for (const [learner, options, expect] of [
      [seeker, { seekTo: 29.5 }, (progress) => !progress.done && progress.credited < 5],
      [double, { rate: 2 }, (progress) => progress.done && progress.credited >= 27],
      [fast, { rate: 4 }, (progress) => !progress.done && progress.credited === 0],
    ]) {
      const other = await ctx.newPage()
      await openAs(ctx, other, learner.email, lessonPath(course, 3))
      const started = Date.now()
      await play(other.page, options)
      const progress = await videoProgress(learner.email, course)
      ctx.check(expect(progress), `${JSON.stringify(options)}: ${progress.credited} s credited, done ${progress.done}, ${Math.round((Date.now() - started) / 1000)} s of real time`)
      ctx.assertClean(other.issues, JSON.stringify(options))
    }
  },
}
