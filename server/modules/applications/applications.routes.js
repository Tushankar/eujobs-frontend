import { Router } from 'express'
import { validate } from '../../lib/validate.js'
import { requireApprovedRecruiter, requireAuth, requireRole } from '../../middleware/auth.js'
import { requireEntitlement } from '../../middleware/entitlements.js'
import * as pipeline from './applications.pipeline.js'
import * as schemas from './applications.schemas.js'
import * as applications from './applications.service.js'
import * as stats from './applications.stats.js'

/* /candidate/applications, /recruiter/applications, /recruiter/pipeline and the Overview charts (§5). */
const idParams = validate({ params: schemas.idParams })

export const candidateRouter = Router()
candidateRouter.use(requireAuth, requireRole('candidate'))

candidateRouter.get('/', async (req, res) => {
  res.json(await applications.listCandidateApplications(req.user))
})

// The apply gate (§3.4): PLAN_REQUIRED here, then PROFILE_INCOMPLETE and JOB_NOT_ACCEPTING in the service.
candidateRouter.post('/', requireEntitlement('apply'), validate({ body: schemas.applyBody }), async (req, res) => {
  res.status(201).json(await applications.apply(req.user, req.body))
})

candidateRouter.get('/:id', idParams, async (req, res) => {
  res.json(await applications.getCandidateApplication(req.user, req.params.id))
})

candidateRouter.post('/:id/withdraw', idParams, async (req, res) => {
  res.json(await applications.withdraw(req.user, req.params.id))
})

export const recruiterRouter = Router()
recruiterRouter.use(requireAuth, requireApprovedRecruiter)

recruiterRouter.get('/', validate({ query: schemas.recruiterListQuery }), async (req, res) => {
  res.json(await applications.listCompanyApplications(req.user, req.company, req.query))
})

recruiterRouter.patch('/:id/stage', idParams, validate({ body: schemas.stageMoveBody }), async (req, res) => {
  res.json(await applications.moveToStage(req.user, req.company, req.params.id, req.body.stageId))
})

recruiterRouter.post('/:id/reject', idParams, validate({ body: schemas.rejectBody }), async (req, res) => {
  res.json(await applications.reject(req.user, req.company, req.params.id, req.body))
})

export const pipelineRouter = Router()
pipelineRouter.use(requireAuth, requireApprovedRecruiter)

pipelineRouter.get('/', async (req, res) => {
  res.json(await pipeline.listStages(req.company))
})

pipelineRouter.post('/stages', validate({ body: schemas.stageBody }), async (req, res) => {
  res.status(201).json(await pipeline.addStage(req.user, req.company, req.body))
})

// Before /stages/:id, so "order" is not read as an id.
pipelineRouter.put('/stages/order', validate({ body: schemas.stageOrderBody }), async (req, res) => {
  res.json(await pipeline.reorderStages(req.company, req.body.ids))
})

pipelineRouter.patch('/stages/:id', idParams, validate({ body: schemas.stagePatchBody }), async (req, res) => {
  res.json(await pipeline.updateStage(req.user, req.company, req.params.id, req.body))
})

pipelineRouter.delete('/stages/:id', idParams, async (req, res) => {
  res.json(await pipeline.removeStage(req.company, req.params.id))
})

// Mounted under /recruiter/overview next to the discovery routes (the funnel and the chart).
export const overviewRouter = Router()
overviewRouter.use(requireAuth, requireApprovedRecruiter)

overviewRouter.get('/funnel', async (req, res) => {
  res.json(await stats.funnel(req.company))
})

overviewRouter.get('/momentum', validate({ query: schemas.momentumQuery }), async (req, res) => {
  const { tz, period } = req.query
  res.json(await stats.momentum(req.company, { timeZone: tz ?? req.user.timezone ?? 'UTC', period }))
})
