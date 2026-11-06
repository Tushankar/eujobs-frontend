import express, { Router } from 'express'
import { LIMITS } from '../../config/limits.js'
import { validate } from '../../lib/validate.js'
import { requireApprovedRecruiter, requireAuth, requireRole } from '../../middleware/auth.js'
import { requireEntitlement } from '../../middleware/entitlements.js'
import { upload } from '../../middleware/upload.js'
import * as documents from './documents.service.js'
import * as call from './interviews.call.js'
import * as schemas from './interviews.schemas.js'
import * as interviews from './interviews.service.js'

/*
 * /interviews and /document-requests (§3.23) for candidates and approved recruiters only (admins never: P11d-Q8).
 * Recruiter Plus (`interviews`) is needed to offer, reschedule, start AI notes (in the service) and request documents;
 * everything already under way works on Free, and candidates are never gated (P11d-Q22, Q27).
 */
const parties = [requireAuth, requireRole('candidate', 'recruiter'), (req, res, next) => (req.user.role === 'recruiter' ? requireApprovedRecruiter(req, res, next) : next())]
const recruiter = requireRole('recruiter')
const candidate = requireRole('candidate')
const plus = requireEntitlement('interviews', ['recruiter'])
const idParams = validate({ params: schemas.idParams })

export const interviewsRouter = Router()
interviewsRouter.use(...parties)

interviewsRouter.get('/upcoming', async (req, res) => {
  res.json(await interviews.upcoming(req.user))
})

interviewsRouter.post('/', recruiter, plus, validate({ body: schemas.offerBody }), async (req, res) => {
  res.status(201).json(await interviews.offer(req.user, req.company, req.body))
})

interviewsRouter.get('/:id', idParams, async (req, res) => {
  res.json(await interviews.getInterview(req.user, req.params.id))
})

interviewsRouter.get('/:id/calendar', idParams, async (req, res) => {
  const { content } = await interviews.calendarFile(req.user, req.params.id)
  res.set('Content-Type', 'text/calendar; charset=utf-8').attachment('interview.ics').send(content)
})

interviewsRouter.post('/:id/pick', idParams, candidate, validate({ body: schemas.pickBody }), async (req, res) => {
  res.json(await interviews.pick(req.user, req.params.id, req.body))
})

interviewsRouter.post('/:id/other-times', idParams, candidate, validate({ body: schemas.noteBody }), async (req, res) => {
  res.json(await interviews.askOtherTimes(req.user, req.params.id, req.body))
})

interviewsRouter.post('/:id/reschedule-request', idParams, candidate, validate({ body: schemas.noteBody }), async (req, res) => {
  res.json(await interviews.requestReschedule(req.user, req.params.id, req.body))
})

interviewsRouter.post('/:id/reschedule', idParams, recruiter, plus, validate({ body: schemas.rescheduleBody }), async (req, res) => {
  res.json(await interviews.reschedule(req.user, req.params.id, req.body))
})

interviewsRouter.post('/:id/cancel', idParams, recruiter, validate({ body: schemas.cancelBody }), async (req, res) => {
  res.json(await interviews.cancel(req.user, req.params.id, req.body))
})

interviewsRouter.post('/:id/outcome', idParams, recruiter, validate({ body: schemas.outcomeBody }), async (req, res) => {
  res.json(await interviews.recordOutcome(req.user, req.company, req.params.id, req.body))
})

interviewsRouter.get('/:id/notes', idParams, recruiter, async (req, res) => {
  res.json(await call.getNotes(req.user, req.params.id))
})

interviewsRouter.post('/:id/join', idParams, async (req, res) => {
  res.json(await call.join(req.user, req.params.id))
})

interviewsRouter.post('/:id/consent', idParams, validate({ body: schemas.consentBody }), async (req, res) => {
  res.json(await call.setConsent(req.user, req.params.id, req.body))
})

interviewsRouter.post('/:id/recording/start', idParams, recruiter, async (req, res) => {
  res.json(await call.startRecording(req.user, req.params.id))
})

interviewsRouter.post(
  '/:id/recording/chunks',
  idParams,
  recruiter,
  validate({ query: schemas.chunkQuery }),
  express.raw({ type: () => true, limit: LIMITS.interviews.chunkMaxBytes }),
  async (req, res) => {
    res.json(await call.addChunk(req.user, req.params.id, req.query.seq, req.body))
  },
)

interviewsRouter.post('/:id/recording/stop', idParams, async (req, res) => {
  res.json(await call.stopRecording(req.user, req.params.id))
})

export const documentsRouter = Router()
documentsRouter.use(...parties)

documentsRouter.post('/', recruiter, plus, upload('document_attachment', { optional: true }), validate({ body: schemas.requestBody }), async (req, res) => {
  res.status(201).json(await documents.createRequest(req.user, req.company, req.body, req.file))
})

documentsRouter.get('/:id', idParams, async (req, res) => {
  res.json(await documents.getRequest(req.user, req.params.id))
})

documentsRouter.post('/:id/items/:itemId', validate({ params: schemas.itemParams }), candidate, upload('document_request'), async (req, res) => {
  res.json(await documents.uploadItem(req.user, req.params.id, req.params.itemId, req.file))
})

documentsRouter.post('/:id/items/:itemId/decline', validate({ params: schemas.itemParams }), candidate, validate({ body: schemas.declineBody }), async (req, res) => {
  res.json(await documents.declineItem(req.user, req.params.id, req.params.itemId, req.body))
})

documentsRouter.post('/:id/complete', idParams, recruiter, async (req, res) => {
  res.json(await documents.completeRequest(req.user, req.params.id))
})
