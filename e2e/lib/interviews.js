import puppeteer from 'puppeteer-core'
import { fixture } from '../fixtures/make.js'
import { openPage } from './browser.js'
import { CHROME, seedCredentials } from './env.js'
import { signInWithForm } from './flows.js'
import { login } from './recruiters.js'
import { api, date, db } from './testApi.js'

/*
 * Phase 11d helpers (§3.23): the seeded pair (Sarah of Acme Studio and Emma, who applied to her Senior Product
 * Designer job), interviews and requests made through the API, the join window moved to now, and a Chrome whose fake
 * camera shows a test pattern and whose fake microphone plays a WAV fixture (one per side of the call).
 */
export const SARAH = () => seedCredentials.email('sarah')
export const EMMA = () => seedCredentials.email('emma')

const ok = (result, label) => {
  if (result.status >= 300) throw new Error(`${label}: ${result.status} ${JSON.stringify(result.body)}`)
  return result.body
}

/** Tokens, the Sarah ↔ Emma thread and Emma's active application with Acme. */
export async function seededPair() {
  const [sarah, emma] = await Promise.all([login(SARAH(), 'recruiter', seedCredentials.password), login(EMMA(), 'candidate', seedCredentials.password)])
  const threads = ok(await api('/conversations', { token: sarah }), 'conversations').items
  const thread = threads.find((item) => item.counterpart?.name === 'Emma Wilson')
  const { cards } = ok(await api(`/conversations/${thread.id}/messages`, { token: sarah }), 'thread')
  return { sarah, emma, threadId: thread.id, applicationId: cards.activeApplications[0].id }
}

const HOUR = 60 * 60 * 1000

/** 2–3 slots `hours` from now, `minutes` long. */
export const slots = (hours = [48, 72], minutes = 30) => hours.map((h) => ({ startAt: new Date(Date.now() + h * HOUR).toISOString(), minutes }))

export const offerApi = (token, body) => api('/interviews', { method: 'POST', token, body: { mode: 'video', slots: slots(), ...body } }).then((result) => ok(result, 'offer'))
export const pickApi = (token, interview, index = 0) => api(`/interviews/${interview.id}/pick`, { method: 'POST', token, body: { startAt: interview.slots[index].startAt } }).then((result) => ok(result, 'pick'))
export const interviewOf = (token, id) => api(`/interviews/${id}`, { token }).then((result) => ok(result, 'interview'))

/** Moves a booked interview's start to `ms` from now (the join window opens 10 minutes before it). */
export const startIn = (id, ms) => db('interviews', 'updateMany', { filter: { _id: { $oid: id } }, update: { $set: { startAt: date(Date.now() + ms) } } })

/** A booked interview of the pair whose join window is open now. */
export async function bookedNow({ sarah, emma, applicationId }, body = {}) {
  const interview = await offerApi(sarah, { applicationId, ...body })
  await pickApi(emma, interview)
  await startIn(interview.id, 5 * 60 * 1000)
  return interview
}

/**
 * A separate Chrome whose fake microphone plays `voiceFile` (a WAV in the fixtures folder) and whose fake camera
 * shows Chrome's test pattern; media prompts are answered yes and audio may start without a click.
 */
export function mediaBrowser(voiceFile) {
  return puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: [
      '--no-first-run',
      '--no-default-browser-check',
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      `--use-file-for-fake-audio-capture=${fixture(voiceFile)}`,
      '--autoplay-policy=no-user-gesture-required',
    ],
  })
}

/** Signs `email` in through the form in its own browser and opens the call page; returns the checked page handle. */
export async function joinCall(ctx, browser, { email, role, interviewId }) {
  const handle = await openPage(browser.defaultBrowserContext(), 'D')
  await signInWithForm(handle.page, ctx.webUrl, role === 'recruiter' ? '/recruiter/sign-in' : '/sign-in', email, seedCredentials.password)
  await handle.page.goto(`${ctx.webUrl}/${role}/interviews/${interviewId}/call`, { waitUntil: 'domcontentloaded' })
  await handle.page.waitForSelector('[data-call-page]', { timeout: 20_000 })
  return handle
}

/** Waits until the call page shows `status` (waiting, connecting, connected, failed). */
export const waitForCall = (page, status, timeout = 30_000) => page.waitForSelector(`[data-call-page][data-call-status="${status}"]`, { timeout })
