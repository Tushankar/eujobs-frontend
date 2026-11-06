import { INTERVIEW_VOICES } from '../fixtures/make.js'
import { bookedNow, EMMA, joinCall, mediaBrowser, SARAH, seededPair, waitForCall } from '../lib/interviews.js'
import { db } from '../lib/testApi.js'

/**
 * P11d-02 (P11d-Q5, Q17): the candidate declines AI notes on screen. Both see that notes are off, no "Recording"
 * shows, the call still connects both ways, and nothing is recorded.
 */
export default {
  name: 'P11d-02 Recording declined',
  viewports: ['D'],
  async run(ctx) {
    const pair = await seededPair()
    const interview = await bookedNow(pair, { aiNotes: true })
    const browsers = await Promise.all([mediaBrowser(INTERVIEW_VOICES.recruiter.file), mediaBrowser(INTERVIEW_VOICES.candidate.file)])
    try {
      const [sarah, emma] = await Promise.all([
        joinCall(ctx, browsers[0], { email: SARAH(), role: 'recruiter', interviewId: interview.id }),
        joinCall(ctx, browsers[1], { email: EMMA(), role: 'candidate', interviewId: interview.id }),
      ])
      await Promise.all([sarah, emma].map((call) => call.page.waitForSelector('[data-consent-prompt]')))
      await sarah.page.click('[data-consent="agree"]')
      await emma.page.click('[data-consent="decline"]')
      await Promise.all([sarah, emma].map((call) => call.page.waitForSelector('[data-consent-state="off"]', { timeout: 20_000 })))
      await Promise.all([sarah, emma].map((call) => waitForCall(call.page, 'connected')))
      await new Promise((resolve) => setTimeout(resolve, 6000))
      for (const call of [sarah, emma]) ctx.check(!(await call.page.$('[data-recording-indicator]')), 'no Recording indicator')
      ctx.check(await emma.page.$eval('[data-video="remote"]', (video) => video.videoWidth > 0), 'Emma sees Sarah’s video')
      await ctx.screenshot(sarah.page, '1-recruiter-notes-off')
      await ctx.screenshot(emma.page, '1-candidate-notes-off')
      ctx.assertClean([...sarah.issues, ...emma.issues], 'call')
      await sarah.page.click('[data-leave-call]')
      await emma.page.click('[data-leave-call]')
    } finally {
      await Promise.all(browsers.map((browser) => browser.close()))
    }
    const [stored] = await db('interviews', 'find', { filter: { _id: { $oid: interview.id } } })
    ctx.check(stored.recording.status === 'off' && !stored.recording.fileId && stored.consent.candidate === false, `nothing recorded (${JSON.stringify(stored.recording)})`)
    ctx.check((await db('files', 'count', { filter: { purpose: 'interview_audio' } })) === 0, 'no audio file')
  },
}
