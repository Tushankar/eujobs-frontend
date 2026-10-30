import { Router } from 'express'
import { validate } from '../../lib/validate.js'
import { requireAuth, requireRole } from '../../middleware/auth.js'
import { requirePermission } from '../../middleware/permissions.js'
import { upload } from '../../middleware/upload.js'
import * as schemas from './verification.schemas.js'
import * as verification from './verification.service.js'

/* /candidate/verification and /admin/moderation/verification (§5). */
export const candidateRouter = Router()
candidateRouter.use(requireAuth, requireRole('candidate'))

candidateRouter.get('/', async (req, res) => {
  res.json(await verification.verificationState(req.user))
})

candidateRouter.post('/phone/code', validate({ body: schemas.phoneCodeBody }), async (req, res) => {
  res.json(await verification.requestPhoneCode(req.user, req.body))
})

candidateRouter.post('/phone/confirm', validate({ body: schemas.phoneConfirmBody }), async (req, res) => {
  await verification.confirmPhone(req.user, req.body.code)
  res.json(await verification.verificationState(req.user))
})

// Multipart with a file, except certificates, which use the certificate's own file (M-025).
candidateRouter.post('/submissions', upload('evidence', { optional: true }), validate({ body: schemas.submissionBody }), async (req, res) => {
  await verification.submitEvidence(req.user, req.body, req.file)
  res.status(201).json(await verification.verificationState(req.user))
})

export const adminRouter = Router()
adminRouter.use(requireAuth, requireRole('admin'), requirePermission('moderation.manage'))

adminRouter.get('/', validate({ query: schemas.queueQuery }), async (req, res) => {
  res.json(await verification.listQueue(req.query.status))
})

adminRouter.get('/:id', validate({ params: schemas.submissionParams }), async (req, res) => {
  res.json(await verification.submissionDetail(req.user, req.params.id))
})

adminRouter.post('/:id/decision', validate({ params: schemas.submissionParams, body: schemas.decisionBody }), async (req, res) => {
  await verification.decide(req.user, req.params.id, req.body)
  res.json(await verification.submissionDetail(req.user, req.params.id))
})
