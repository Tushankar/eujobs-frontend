import { Router } from 'express'
import { aiStatus } from '../../lib/ai.js'
import { validate } from '../../lib/validate.js'
import { requireAuth, requireRole } from '../../middleware/auth.js'
import { requirePermission } from '../../middleware/permissions.js'
import * as admin from './matching.admin.js'
import * as schemas from './matching.schemas.js'

/* /admin/matching and /admin/ai (§5): `ai.view` reads, `ai.manage` changes (M-155). */
const view = requirePermission('ai.view')
const manage = requirePermission('ai.manage')
const idParams = validate({ params: schemas.idParams })

export const adminMatchingRouter = Router()
adminMatchingRouter.use(requireAuth, requireRole('admin'))

adminMatchingRouter.get('/policies', view, async (req, res) => {
  res.json(await admin.listPolicies())
})

adminMatchingRouter.post('/policies', manage, validate({ body: schemas.createBody }), async (req, res) => {
  res.status(201).json(await admin.createPolicy(req.user, req.body))
})

adminMatchingRouter.post('/policies/suggest', manage, validate({ body: schemas.suggestBody }), async (req, res) => {
  res.json(await admin.suggestDescription(req.user, req.body))
})

adminMatchingRouter.patch('/policies/:id', manage, idParams, validate({ body: schemas.updateBody }), async (req, res) => {
  res.json(await admin.updatePolicy(req.user, req.params.id, req.body))
})

adminMatchingRouter.put('/policies/:id/signals', manage, idParams, validate({ body: schemas.signalsBody }), async (req, res) => {
  res.json(await admin.saveSignals(req.user, req.params.id, req.body))
})

adminMatchingRouter.post('/policies/:id/activate', manage, idParams, async (req, res) => {
  res.json(await admin.activatePolicy(req.user, req.params.id))
})

adminMatchingRouter.post('/policies/:id/archive', manage, idParams, async (req, res) => {
  res.json(await admin.archivePolicy(req.user, req.params.id))
})

adminMatchingRouter.get('/feedback', view, async (req, res) => {
  res.json(await admin.feedbackSummary())
})

adminMatchingRouter.get('/oversight', view, validate({ query: schemas.oversightQuery }), async (req, res) => {
  res.json(await admin.oversight(req.query))
})

export const adminAiRouter = Router()
adminAiRouter.use(requireAuth, requireRole('admin'))

adminAiRouter.get('/status', view, async (req, res) => {
  res.json(await aiStatus())
})
