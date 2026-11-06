import { INTERVIEW_VOICES } from '../fixtures/make.js'
import { seedCredentials } from '../lib/env.js'
import { responseTo, signInWithForm } from '../lib/flows.js'
import { EMMA, interviewOf, joinCall, mediaBrowser, SARAH, seededPair, startIn, waitForCall } from '../lib/interviews.js'
import { notificationsOf } from '../lib/notifications.js'
import { until } from '../lib/payments.js'
import { api, db, mailTo } from '../lib/testApi.js'

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * P11d-01 (§3.23, P11d-Q1 … Q5, Q13, Q16, Q17; owner answer A4): Sarah offers three times with AI notes from the
 * thread; Emma sees them in her own time zone and books one; both get the bell, the invite with the .ics, the event
 * line and the Upcoming strip. On D both then join in two Chromes with fake cameras and microphones (a different
 * sentence each), both agree, "Recording" shows on both, each speaks in turn (the other muted), Sarah stops; the
 * real OpenAI notes reach Sarah only and their transcript holds both sentences; the audio file is deleted.
 */
export default {
  name: 'P11d-01 Schedule, book, call and AI notes',
  viewports: ['D', 'M'],
  async run(ctx) {
    const pair = await seededPair()
    const recruiterPage = await ctx.newPage()
    const candidatePage = await ctx.newPage()
    const sarahPage = recruiterPage.page
    const emmaPage = candidatePage.page
    // Each viewer's own time zone (P11d-Q3).
    await sarahPage.emulateTimezone('Europe/London')
    await emmaPage.emulateTimezone('Europe/Madrid')
    await signInWithForm(sarahPage, ctx.webUrl, '/recruiter/sign-in', SARAH(), seedCredentials.password)
    await signInWithForm(emmaPage, ctx.webUrl, '/sign-in', EMMA(), seedCredentials.password)

    // Sarah offers the three suggested times with AI notes.
    await sarahPage.goto(`${ctx.webUrl}/recruiter/messages/${pair.threadId}`, { waitUntil: 'networkidle0' })
    await sarahPage.click('[data-schedule-interview]')
    await sarahPage.waitForSelector('[role="dialog"] [data-slot-row="2"]')
    await sarahPage.click('label:has([data-ai-notes])')
    await recruiterPage.checkOverflow()
    await ctx.screenshot(sarahPage, '1-offer-dialog')
    const sent = responseTo(sarahPage, '/api/v1/interviews', 'POST')
    await sarahPage.click('[data-offer-submit]')
    const offered = await (await sent).json()
    ctx.check(offered.status === 'offered' && offered.slots.length === 3 && offered.aiNotes, `offer ${JSON.stringify(offered).slice(0, 160)}`)
    await sarahPage.waitForSelector(`[data-interview-card="${offered.id}"][data-interview-status="offered"]`)

    // Emma sees the times in Madrid time and books the first.
    ctx.check((await mailTo(EMMA(), 'interview_invitation')).length === 1, 'Emma got the invitation email')
    await emmaPage.goto(`${ctx.webUrl}/candidate/messages/${pair.threadId}`, { waitUntil: 'networkidle0' })
    const card = `[data-interview-card="${offered.id}"]`
    await emmaPage.waitForSelector(`${card} [data-slot]`)
    await candidatePage.checkOverflow()
    await ctx.screenshot(emmaPage, '2-candidate-card')
    await emmaPage.click(`${card} [data-slot]`)
    const picked = responseTo(emmaPage, `/interviews/${offered.id}/pick`, 'POST')
    await emmaPage.click(`${card} [data-pick-slot]`)
    ctx.check((await picked).status() === 200, 'the pick is accepted')
    await emmaPage.waitForSelector(`${card}[data-interview-status="confirmed"]`)
    await sarahPage.reload({ waitUntil: 'networkidle0' })
    await sarahPage.waitForSelector(`${card}[data-interview-status="confirmed"]`)
    const [sarahWhen, emmaWhen] = await Promise.all([sarahPage, emmaPage].map((page) => page.$eval(`${card} [data-interview-when]`, (node) => node.textContent)))
    ctx.check(sarahWhen !== emmaWhen, `each viewer's own time zone (${sarahWhen} / ${emmaWhen})`)
    ctx.check(await emmaPage.$(`[data-event="interview.offered"]`), 'the earlier step is an event line')

    for (const [email, label] of [[SARAH(), 'Sarah'], [EMMA(), 'Emma']]) {
      const [mail] = await mailTo(email, 'interview_confirmed')
      ctx.check(mail?.ical?.method === 'REQUEST' && mail.ical.content.includes(`UID:interview-${offered.id}`), `${label}: booked email with the .ics invite`)
    }
    for (const [token, label] of [[pair.sarah, 'Sarah'], [pair.emma, 'Emma']]) {
      const { items } = await notificationsOf(token)
      ctx.check(items.some((item) => item.type === 'interview_confirmed' && item.path.endsWith(`/interviews/${offered.id}`)), `${label}: booked notification`)
    }
    await emmaPage.goto(`${ctx.webUrl}/candidate/applications`, { waitUntil: 'networkidle0' })
    await emmaPage.waitForSelector(`[data-upcoming-interview="${offered.id}"]`)
    await candidatePage.checkOverflow()
    await ctx.screenshot(emmaPage, '3-upcoming')
    ctx.assertClean([...recruiterPage.issues, ...candidatePage.issues], 'booking')
    if (ctx.viewport !== 'D') return

    // The call: two Chromes, one fake microphone sentence each.
    await startIn(offered.id, 5 * 60 * 1000)
    const browsers = await Promise.all([mediaBrowser(INTERVIEW_VOICES.recruiter.file), mediaBrowser(INTERVIEW_VOICES.candidate.file)])
    try {
      const [sarahCall, emmaCall] = await Promise.all([
        joinCall(ctx, browsers[0], { email: SARAH(), role: 'recruiter', interviewId: offered.id }),
        joinCall(ctx, browsers[1], { email: EMMA(), role: 'candidate', interviewId: offered.id }),
      ])
      for (const call of [sarahCall, emmaCall]) await call.page.waitForSelector('[data-consent-prompt]')
      await ctx.screenshot(emmaCall.page, '4-consent')
      await sarahCall.page.click('[data-consent="agree"]')
      await emmaCall.page.click('[data-consent="agree"]')
      await Promise.all([sarahCall, emmaCall].map((call) => waitForCall(call.page, 'connected')))
      await Promise.all([sarahCall, emmaCall].map((call) => call.page.waitForSelector('[data-recording-indicator]', { timeout: 30_000 })))
      await ctx.screenshot(sarahCall.page, '5-recording-recruiter')
      await ctx.screenshot(emmaCall.page, '5-recording-candidate')
      ctx.check(await sarahCall.page.$eval('[data-video="remote"]', (video) => video.videoWidth > 0), 'Sarah sees Emma’s video')

      // Each speaks in turn: Emma muted while Sarah's sentence plays, then the other way round.
      await emmaCall.page.click('[data-call-page] footer button[aria-pressed]')
      await pause(9000)
      await sarahCall.page.click('[data-call-page] footer button[aria-pressed]')
      await emmaCall.page.click('[data-call-page] footer button[aria-pressed]')
      await pause(9000)
      const stopped = responseTo(sarahCall.page, `/interviews/${offered.id}/recording/stop`, 'POST')
      await sarahCall.page.click('[data-stop-recording]')
      await stopped
      await emmaCall.page.waitForFunction(() => !document.querySelector('[data-recording-indicator]'), { timeout: 15_000 })
      await pause(3000)
      ctx.assertClean([...sarahCall.issues, ...emmaCall.issues], 'call')
      await sarahCall.page.click('[data-leave-call]')
      await emmaCall.page.click('[data-leave-call]')
    } finally {
      await Promise.all(browsers.map((browser) => browser.close()))
    }

    // The notes task (real OpenAI) runs on the next tick after the 15-second delay.
    const audio = (await db('interviews', 'find', { filter: { _id: { $oid: offered.id } } }))[0].recording
    ctx.check(audio.bytes > 20_000, `audio was uploaded (${audio.bytes} bytes)`)
    await api('/_test/scheduler/tick', { method: 'POST', body: { now: new Date(Date.now() + 30_000).toISOString() } })
    await until(() => interviewOf(pair.sarah, offered.id), (item) => item.hasNotes, { timeout: 120_000, label: 'AI notes' })
    const notes = (await api(`/interviews/${offered.id}/notes`, { token: pair.sarah })).body
    const transcript = notes.transcript.toLowerCase()
    ctx.note(`transcript: ${notes.transcript}`)
    ctx.check(transcript.includes(INTERVIEW_VOICES.recruiter.keyword) && transcript.includes(INTERVIEW_VOICES.candidate.keyword), 'the transcript holds both voices')
    ctx.check(notes.summary.length > 20 && Array.isArray(notes.followUps), 'summary and lists')
    ctx.check((await db('files', 'count', { filter: { purpose: 'interview_audio' } })) === 0, 'the audio file is deleted')
    ctx.check((await api(`/interviews/${offered.id}/notes`, { token: pair.emma })).status === 403, 'Emma cannot read the notes')

    await sarahPage.goto(`${ctx.webUrl}/recruiter/messages/${pair.threadId}?card=${offered.id}`, { waitUntil: 'networkidle0' })
    await sarahPage.click(`${card} [data-open-notes]`)
    await sarahPage.waitForSelector('[data-notes-summary]')
    await ctx.screenshot(sarahPage, '6-notes')
    await emmaPage.goto(`${ctx.webUrl}/candidate/messages/${pair.threadId}`, { waitUntil: 'networkidle0' })
    await emmaPage.waitForSelector(card)
    ctx.check(!(await emmaPage.$(`${card} [data-open-notes]`)), 'Emma’s card has no notes')
    ctx.assertClean([...recruiterPage.issues, ...candidatePage.issues], 'notes')
  },
}
