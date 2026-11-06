import { createHmac } from 'node:crypto'
import { appendFile } from 'node:fs/promises'
import jwt from 'jsonwebtoken'
import { WebSocketServer } from 'ws'
import { config } from '../../config/env.js'
import { LIMITS } from '../../config/limits.js'
import { scheduleTask, taskHandlers } from '../../jobs/scheduler.js'
import { transcribe } from '../../lib/ai.js'
import { AppError } from '../../lib/errors.js'
import { absolutePath, removeFiles, storeFile } from '../../lib/files.js'
import { hasEntitlement, planRequired } from '../../middleware/entitlements.js'
import { write } from '../ai/ai.facts.js'
import { PROMPTS } from '../ai/ai.prompts.js'
import { File } from '../files/files.model.js'
import { companyRecruiter, notify } from '../notifications/notifications.service.js'
import { User } from '../users/users.model.js'
import { interviewDtos, joinWindow } from './interviews.cards.js'
import { Interview } from './interviews.model.js'
import { ownInterview } from './interviews.service.js'

/*
 * The in-app video interview (§3.23, P11d-Q2, Q5, Q17, Q18, Q26): the join window, the ICE servers (Google STUN plus
 * short-lived Cloudflare TURN credentials, P11d-Q29), the signaling WebSocket that relays offer/answer/ICE between the two
 * parties of one interview, the on-screen AI-notes consent, the audio recording (made in the recruiter's browser,
 * uploaded in chunks, refused unless both agreed) and the notes task that transcribes, summarises and deletes the audio.
 */
const L = LIMITS.interviews
export const SIGNAL_PATH = '/api/v1/interviews/signal'
const STUN = { urls: ['stun:stun.l.google.com:19302'] }
const TURN_URL = (keyId) => `https://rtc.live.cloudflare.com/v1/turn/keys/${keyId}/credentials/generate-ice-servers`
// The ticket is signed with its own key (derived from the JWT secret), so it can never pass as a session token.
const ticketKey = () => createHmac('sha256', config.jwt.secret).update('interview-signal').digest('hex')
const NOTES_DELAY_MS = 15_000
// A chunk already on its way when someone pressed Stop is still accepted for this long.
const FLUSH_GRACE_MS = 10_000

const conflict = (reason, params = {}) => new AppError('CONFLICT', { params: { reason, ...params } })
const sideOf = (user) => (user.role === 'candidate' ? 'candidate' : 'recruiter')
const dto = async (user, interview) => (await interviewDtos(user, [interview]))[0]

/* ---------- ICE servers ---------- */

let turnFetch = globalThis.fetch
/** API tests replace the TURN request; no argument restores fetch. */
export function setTurnFetch(fake) {
  turnFetch = fake ?? globalThis.fetch
}

/** Google STUN, plus Cloudflare TURN credentials valid `ttlSeconds` when configured; port 53 URLs time out in browsers. */
export async function iceServers(ttlSeconds) {
  if (!config.turn) return [STUN]
  try {
    const response = await turnFetch(TURN_URL(config.turn.keyId), {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.turn.apiToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ttl: ttlSeconds }),
      signal: AbortSignal.timeout(5000),
    })
    if (!response.ok) throw new Error(`status ${response.status}`)
    const { iceServers: servers } = await response.json()
    const turn = [servers]
      .flat()
      .map((server) => ({ ...server, urls: [server.urls].flat().filter((url) => !/:53(\?|$)/.test(url)) }))
      .filter((server) => server.urls.length)
    return [STUN, ...turn]
  } catch (error) {
    console.error(`TURN credentials unavailable: ${error.name === 'TimeoutError' ? 'timeout' : error.message}`)
    return [STUN]
  }
}

/* ---------- join ---------- */

function openWindow(interview, now) {
  if (interview.status !== 'confirmed' || interview.mode !== 'video') throw conflict(interview.status === 'confirmed' ? 'not_video' : interview.status)
  const { opensAt, closesAt } = joinWindow(interview)
  if (now < opensAt) throw conflict('too_early', { opensAt })
  if (now > closesAt) throw conflict('closed')
  return closesAt
}

/**
 * POST /interviews/:id/join: inside the window (10 minutes before the start until 30 minutes after the end), the ICE
 * servers, a 2-minute signaling ticket and the phone for the "cannot connect" fallback (P11d-Q2, Q23): the candidate's
 * own phone, or for the recruiter the candidate's.
 */
export async function join(user, id, now = new Date()) {
  const interview = await ownInterview(user, id)
  const closesAt = openWindow(interview, now)
  const side = sideOf(user)
  if (!interview.joined?.[side]) await Interview.updateOne({ _id: interview._id }, { $set: { [`joined.${side}`]: now } })
  const candidate = await User.findById(interview.candidateId, 'phone')
  const ticket = jwt.sign({ interviewId: String(interview._id), side }, ticketKey(), { expiresIn: Math.ceil(L.ticketTtlMs / 1000), audience: 'interview-signal' })
  return {
    interview: await dto(user, interview),
    side,
    ticket,
    iceServers: await iceServers(Math.ceil((closesAt - now) / 1000) + 600),
    connectTimeoutMs: L.connectTimeoutMs,
    fallbackPhone: candidate?.phone?.verifiedAt ? candidate.phone.e164 : null,
  }
}

/* ---------- signaling ---------- */

/** interviewId → { recruiter, candidate } open sockets; one per side (a new one replaces the old). */
const rooms = new Map()

const send = (socket, message) => {
  if (socket?.readyState === 1) socket.send(JSON.stringify(message))
}

/** Sends a message to both sides of an interview that are connected. */
export function broadcast(interviewId, message) {
  const room = rooms.get(String(interviewId))
  if (room) for (const socket of Object.values(room)) send(socket, message)
}

/** Whether both sides are connected right now. */
const bothConnected = (interviewId) => {
  const room = rooms.get(String(interviewId))
  return Boolean(room?.recruiter && room?.candidate)
}

function connect(socket, { interviewId, side }) {
  const room = rooms.get(interviewId) ?? {}
  rooms.set(interviewId, room)
  const otherSide = side === 'candidate' ? 'recruiter' : 'candidate'
  room[side]?.close(4000, 'replaced')
  room[side] = socket
  socket.isAlive = true
  socket.on('pong', () => {
    socket.isAlive = true
  })
  send(socket, { type: 'ready', peer: Boolean(room[otherSide]) })
  send(room[otherSide], { type: 'peer-joined' })
  socket.on('message', (raw) => {
    let message
    try {
      message = JSON.parse(raw)
    } catch {
      return
    }
    // Only offers, answers and ICE candidates are relayed; everything else is decided through the REST routes.
    if (message?.type === 'signal') send(room[otherSide], { type: 'signal', data: message.data })
  })
  socket.on('close', () => {
    if (room[side] !== socket) return
    delete room[side]
    send(room[otherSide], { type: 'peer-left' })
    if (!room.recruiter && !room.candidate) rooms.delete(interviewId)
  })
}

/** Attaches the signaling WebSocket to the HTTP server: a valid ticket for an interview whose window is open. */
export function attachSignaling(server) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 })
  server.on('upgrade', async (req, socket, head) => {
    const url = new URL(req.url, 'http://localhost')
    if (url.pathname !== SIGNAL_PATH) return socket.destroy()
    try {
      const claims = jwt.verify(url.searchParams.get('ticket') ?? '', ticketKey(), { audience: 'interview-signal', algorithms: ['HS256'] })
      openWindow(await Interview.findById(claims.interviewId), new Date())
      wss.handleUpgrade(req, socket, head, (ws) => connect(ws, claims))
    } catch {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
      socket.destroy()
    }
  })
  const heartbeat = setInterval(() => {
    for (const socket of wss.clients) {
      if (!socket.isAlive) socket.terminate()
      socket.isAlive = false
      socket.ping()
    }
  }, 30_000)
  heartbeat.unref()
  server.on('close', () => clearInterval(heartbeat))
  return wss
}

/* ---------- consent and recording ---------- */

const state = (interview) => ({ type: 'state', consent: { recruiter: interview.consent.recruiter, candidate: interview.consent.candidate }, recording: interview.recording.status })

/** POST /interviews/:id/consent: each side answers once, on screen, inside the window (P11d-Q5, Q17). */
export async function setConsent(user, id, { agree }, now = new Date()) {
  const current = await ownInterview(user, id)
  openWindow(current, now)
  if (!current.aiNotes) throw conflict('no_ai_notes')
  const side = sideOf(user)
  const interview = await Interview.findOneAndUpdate({ _id: current._id, [`consent.${side}`]: null }, { $set: { [`consent.${side}`]: agree } }, { returnDocument: 'after' })
  if (!interview) throw conflict('answered')
  broadcast(interview._id, state(interview))
  return dto(user, interview)
}

/**
 * POST /interviews/:id/recording/start (the recruiter's browser): only when both agreed and both are in the call; starting
 * needs Recruiter Plus (P11d-Q27).
 */
export async function startRecording(user, id, now = new Date()) {
  const current = await ownInterview(user, id)
  openWindow(current, now)
  if (current.consent.recruiter !== true || current.consent.candidate !== true) throw conflict('no_consent')
  if (!bothConnected(current._id)) throw conflict('not_connected')
  if (!(await hasEntitlement(user, 'interviews'))) throw planRequired('interviews')
  const interview = await Interview.findOneAndUpdate({ _id: current._id, 'recording.status': 'off' }, { $set: { 'recording.status': 'recording', 'recording.startedAt': now } }, { returnDocument: 'after' })
  if (!interview) throw conflict('recording_' + current.recording.status)
  broadcast(interview._id, state(interview))
  return dto(user, interview)
}

/**
 * POST /interviews/:id/recording/chunks?seq=n (the recruiter's browser): audio appended in order to one file. Refused
 * unless both agreed and the recording runs (or was stopped a moment ago, for the chunk already on its way).
 */
export async function addChunk(user, id, seq, buffer, now = new Date()) {
  const interview = await ownInterview(user, id)
  const { recording, consent } = interview
  const flushing = recording.status === 'processing' && recording.stoppedAt && now - recording.stoppedAt < FLUSH_GRACE_MS
  if (consent.recruiter !== true || consent.candidate !== true || !(recording.status === 'recording' || flushing)) throw conflict('not_recording')
  if (!buffer?.length) throw conflict('empty')
  if (seq < recording.nextSeq) return { stored: false }
  if (recording.bytes + buffer.length > L.audioMaxBytes) {
    await stop(interview, 'system', now)
    throw new AppError('FILE_TOO_LARGE', { params: { maxBytes: L.audioMaxBytes } })
  }
  // Claims this sequence number, so chunks are written once and in order.
  const claimed = await Interview.findOneAndUpdate({ _id: interview._id, 'recording.nextSeq': seq }, { $inc: { 'recording.nextSeq': 1, 'recording.bytes': buffer.length } })
  if (!claimed) throw conflict('out_of_order')
  if (seq === 0) {
    const file = await storeFile({ ownerId: interview.candidateId, purpose: 'interview_audio', buffer, ext: 'webm', originalName: 'interview.webm' })
    await Interview.updateOne({ _id: interview._id }, { $set: { 'recording.fileId': file._id } })
  } else {
    const file = await File.findById(recording.fileId)
    if (!file) throw conflict('not_recording')
    await appendFile(absolutePath(file), buffer)
    await File.updateOne({ _id: file._id }, { $inc: { size: buffer.length }, $unset: { sha256: 1 } })
  }
  return { stored: true }
}

/** Stops a running recording and schedules the notes (a moment later, for the last chunk). */
async function stop(interview, by, now) {
  const stopped = await Interview.findOneAndUpdate(
    { _id: interview._id, 'recording.status': 'recording' },
    { $set: { 'recording.status': 'processing', 'recording.stoppedAt': now, 'recording.stoppedBy': by } },
    { returnDocument: 'after' },
  )
  if (!stopped) return interview
  await scheduleTask({ type: 'interview.notes', key: `interview.notes:${interview._id}`, dueAt: new Date(now.getTime() + NOTES_DELAY_MS), payload: { interviewId: String(interview._id) } })
  broadcast(stopped._id, state(stopped))
  return stopped
}

/** POST /interviews/:id/recording/stop: either side, at any time (P11d-Q18). */
export async function stopRecording(user, id, now = new Date()) {
  const interview = await ownInterview(user, id)
  return dto(user, await stop(interview, sideOf(user), now))
}

/** GET /interviews/:id/notes: the company's AI notes and transcript (P11d-Q5); never the candidate's or an admin's. */
export async function getNotes(user, id) {
  const interview = await ownInterview(user, id)
  if (!interview.notes?.generatedAt || interview.purgedAt) throw new AppError('NOT_FOUND')
  const { summary, keyAnswers, strengths, concerns, followUps, language, generatedAt } = interview.notes
  return { summary, keyAnswers, strengths, concerns, followUps, language, generatedAt, transcript: interview.transcript ?? '' }
}

/* ---------- tasks ---------- */

// P11d-Q26: the window closes; an agreed recording stops with it.
taskHandlers['interview.close'] = async (payload, task, now) => {
  const interview = await Interview.findById(payload.interviewId)
  if (interview?.recording.status === 'recording') await stop(interview, 'system', now)
}

/** P11d-Q5: transcribe, summarise in the recruiter's language, delete the audio, tell the recruiter. */
taskHandlers['interview.notes'] = async (payload, task) => {
  const interview = await Interview.findById(payload.interviewId)
  if (interview?.recording.status !== 'processing') return
  const file = interview.recording.fileId && (await File.findById(interview.recording.fileId))
  const fail = () => Interview.updateOne({ _id: interview._id }, { $set: { 'recording.status': 'failed' } })
  if (!file) return fail()
  try {
    const recruiter = (await User.findById(interview.createdBy)) ?? (await companyRecruiter(interview.companyId))
    const transcript = (await transcribe(absolutePath(file))).trim()
    const notes = await write(PROMPTS.interviewNotes, { user: recruiter, input: { transcript }, subjectId: interview.candidateId, model: 'main', cache: false })
    await Interview.updateOne(
      { _id: interview._id },
      { $set: { transcript, notes: { ...notes, language: recruiter.language, generatedAt: new Date() }, 'recording.status': 'ready', 'recording.fileId': null } },
    )
    await removeFiles([file._id])
    await notify(recruiter, 'interview_notes_ready', { params: { candidate: (await User.findById(interview.candidateId, 'fullName'))?.fullName ?? '' }, target: { kind: 'interview', id: interview._id } })
  } catch (error) {
    if (task.attempts >= 3) await fail()
    throw error
  }
}
