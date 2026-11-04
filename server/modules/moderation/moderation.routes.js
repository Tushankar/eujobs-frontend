import { Router } from 'express'
import { validate } from '../../lib/validate.js'
import { requireApprovedRecruiter, requireAuth, requireRole } from '../../middleware/auth.js'
import { requirePermission } from '../../middleware/permissions.js'
import * as schemas from './moderation.schemas.js'
import * as moderation from './moderation.service.js'

/* POST /reports (candidates and approved recruiters) and /admin/moderation content cases (§5, M-164, M-167). */
export const reportsRouter = Router()
reportsRouter.use(requireAuth, requireRole('candidate', 'recruiter'), (req, res, next) => (req.user.role === 'recruiter' ? requireApprovedRecruiter(req, res, next) : next()))

reportsRouter.post('/', validate({ body: schemas.reportBody }), async (req, res) => {
  res.status(201).json(await moderation.report(req.user, req.company, req.body))
})

export const adminRouter = Router()
adminRouter.use(requireAuth, requireRole('admin'), requirePermission('moderation.manage'))

adminRouter.get('/summary', async (req, res) => {
  res.json(await moderation.summary())
})

adminRouter.get('/content', async (req, res) => {
  res.json(await moderation.listCases())
})

adminRouter.get('/content/:id', validate({ params: schemas.idParams }), async (req, res) => {
  res.json(await moderation.caseDetail(req.user, req.params.id))
})

adminRouter.post('/content/:id/decision', validate({ params: schemas.idParams, body: schemas.decisionBody }), async (req, res) => {
  res.json(await moderation.decide(req.user, req.params.id, req.body))
})
