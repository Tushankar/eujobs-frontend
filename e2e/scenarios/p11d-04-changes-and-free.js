import { setTextarea } from '../lib/applicants.js'
import { seedCredentials } from '../lib/env.js'
import { responseTo, signInWithForm } from '../lib/flows.js'
import { EMMA, offerApi, pickApi, SARAH, seededPair, startIn } from '../lib/interviews.js'
import { notificationsOf } from '../lib/notifications.js'
import { expectLock, trackRequests } from '../lib/recruiterPlan.js'
import { db, mailTo } from '../lib/testApi.js'

/** Writes a note in the open note dialog and sends it; waits for `path`'s POST. */
async function sendNote(page, path, text) {
  await page.waitForSelector('[role="dialog"] [data-note-field]')
  if (text) await setTextarea(page, '[role="dialog"] [data-note-field]', text)
  const sent = responseTo(page, path, 'POST')
  await page.click('[role="dialog"] [data-note-submit]')
  return (await sent).status()
}

/**
 * P11d-04 (P11d-Q3, Q14, Q15, Q27): other times with a note → Sarah offers new times → Emma books → Emma asks to
 * reschedule → Sarah cancels; each step reaches the other side (bell and email, the cancellation with a calendar
 * cancel). Then Sarah's Recruiter Plus ends: Schedule interview, Request documents and Reschedule are locked (upgrade
 * dialog, no request), while a booked interview still gets its outcome.
 */
export default {
  name: 'P11d-04 Changes and the Free recruiter',
  viewports: ['D', 'M'],
  async run(ctx) {
    const pair = await seededPair()
    const recruiter = await ctx.newPage()
    const candidate = await ctx.newPage()
    const sarah = recruiter.page
    const emma = candidate.page
    await signInWithForm(sarah, ctx.webUrl, '/recruiter/sign-in', SARAH(), seedCredentials.password)
    await signInWithForm(emma, ctx.webUrl, '/sign-in', EMMA(), seedCredentials.password)
    const thread = (role) => `${ctx.webUrl}/${role}/messages/${pair.threadId}`

    const interview = await offerApi(pair.sarah, { applicationId: pair.applicationId })
    const card = `[data-interview-card="${interview.id}"]`
    await emma.goto(thread('candidate'), { waitUntil: 'networkidle0' })
    await emma.click(`${card} [data-other-times]`)
    ctx.check((await sendNote(emma, `/interviews/${interview.id}/other-times`, 'Friday morning works best for me.')) === 200, 'other times sent')
    ctx.check((await mailTo(SARAH(), 'interview_other_times'))[0]?.params.noteLine.includes('Friday morning'), 'Sarah gets the note by email')
    ctx.check((await notificationsOf(pair.sarah)).items.some((item) => item.type === 'interview_other_times'), 'Sarah gets the bell')

    await sarah.goto(thread('recruiter'), { waitUntil: 'networkidle0' })
    await sarah.click(`${card} [data-reschedule]`)
    await sarah.waitForSelector('[role="dialog"] [data-slot-row="1"]')
    const renewed = responseTo(sarah, `/interviews/${interview.id}/reschedule`, 'POST')
    await sarah.click('[data-offer-submit]')
    ctx.check((await renewed).status() === 200, 'new times sent')
    ctx.check((await mailTo(EMMA(), 'interview_rescheduled')).length === 1, 'Emma is told about the new times')

    await emma.reload({ waitUntil: 'networkidle0' })
    await emma.click(`${card} [data-slot]`)
    const picked = responseTo(emma, `/interviews/${interview.id}/pick`, 'POST')
    await emma.click(`${card} [data-pick-slot]`)
    await picked
    await emma.waitForSelector(`${card}[data-interview-status="confirmed"] [data-ask-reschedule]`)
    await emma.click(`${card} [data-ask-reschedule]`)
    ctx.check((await sendNote(emma, `/interviews/${interview.id}/reschedule-request`, 'I have a clash that day.')) === 200, 'reschedule asked')
    ctx.check((await mailTo(SARAH(), 'interview_reschedule_request')).length === 1, 'Sarah is told about the request')
    await candidate.checkOverflow()
    await ctx.screenshot(emma, '1-candidate-asked')

    await sarah.reload({ waitUntil: 'networkidle0' })
    await sarah.click(`${card} [data-cancel-interview]`)
    ctx.check((await sendNote(sarah, `/interviews/${interview.id}/cancel`, 'The role is on hold.')) === 200, 'cancelled')
    const [cancelMail] = await mailTo(EMMA(), 'interview_cancelled')
    ctx.check(cancelMail?.ical?.method === 'CANCEL', 'the cancellation carries a calendar cancel')
    ctx.check((await notificationsOf(pair.emma)).items.some((item) => item.type === 'interview_cancelled'), 'Emma gets the bell')
    await sarah.waitForSelector(`${card}[data-interview-status="cancelled"]`)
    await recruiter.checkOverflow()
    await ctx.screenshot(sarah, '2-recruiter-cancelled')

    // Recruiter Plus ends: new work is locked; the booked interview still gets its outcome (P11d-Q27).
    const booked = await offerApi(pair.sarah, { applicationId: pair.applicationId })
    await pickApi(pair.emma, booked)
    await startIn(booked.id, -10 * 60 * 1000)
    const [sarahUser] = await db('users', 'find', { filter: { email: SARAH() } })
    await db('subscriptions', 'updateMany', { filter: { userId: sarahUser._id }, update: { $set: { status: 'canceled' } } })
    try {
      await sarah.reload({ waitUntil: 'networkidle0' })
      const requests = trackRequests(sarah)
      await expectLock(ctx, sarah, requests, { label: 'schedule', click: () => sarah.click('[data-schedule-interview]'), forbidden: /\/interviews$/ })
      await expectLock(ctx, sarah, requests, { label: 'documents', click: () => sarah.click('[data-request-documents]'), forbidden: /\/document-requests$/ })
      const bookedCard = `[data-interview-card="${booked.id}"]`
      await sarah.click(`${bookedCard} [data-record-outcome]`)
      await sarah.click('[role="dialog"] label:has([data-outcome="offer"])')
      const outcome = responseTo(sarah, `/interviews/${booked.id}/outcome`, 'POST')
      await sarah.click('[data-outcome-submit]')
      ctx.check((await outcome).status() === 200, 'the outcome is recorded on Free')
      await sarah.waitForSelector(`${bookedCard}[data-interview-status="completed"] [data-interview-outcome="offer"]`)
      await recruiter.checkOverflow()
      await ctx.screenshot(sarah, '3-free-outcome')
    } finally {
      await db('subscriptions', 'updateMany', { filter: { userId: sarahUser._id }, update: { $set: { status: 'active' } } })
    }
    ctx.assertClean([...recruiter.issues, ...candidate.issues], 'changes')
  },
}
