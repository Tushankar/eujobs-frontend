import { Router } from 'express'
import { z } from 'zod'
import { objectId, validate } from '../../lib/validate.js'
import { requireApprovedRecruiter, requireAuth, requireRole } from '../../middleware/auth.js'
import { requirePermission } from '../../middleware/permissions.js'
import { requireDiscovery } from '../discovery/discovery.routes.js'
import { relevantTalent } from '../discovery/discovery.service.js'
import { caseBody } from '../moderation/moderation.schemas.js'
import { openJobCase } from '../moderation/moderation.service.js'
import * as schemas from './jobs.schemas.js'
import * as search from './jobs.search.js'
import * as jobs from './jobs.service.js'

/* /recruiter/jobs and /skills (approved recruiters), /jobs and /candidate/saved-jobs (candidates), /admin/jobs (§5). */
const jobParams = validate({ params: schemas.jobParams })

export const recruiterRouter = Router()
recruiterRouter.use(requireAuth, requireApprovedRecruiter)

recruiterRouter.get('/', async (req, res) => {
  res.json(await jobs.listJobs(req.company))
})

// The body is checked in the service, so a 422 can name the wizard step (M-039).
recruiterRouter.post('/', async (req, res) => {
  const job = await jobs.createJob(req.user, req.company, req.body)
  res.status(201).json(jobs.jobDto(job, req.company))
})

recruiterRouter.post('/quality-checks', validate({ body: schemas.jobBody.partial() }), (req, res) => {
  res.json({ items: jobs.qualityChecks(req.body) })
})

recruiterRouter.get('/:id', jobParams, async (req, res) => {
  res.json(await jobs.getJob(req.company, req.params.id))
})

recruiterRouter.put('/:id', jobParams, async (req, res) => {
  res.json(jobs.jobDto(await jobs.updateJob(req.user, req.company, req.params.id, req.body), req.company))
})

recruiterRouter.patch('/:id/status', jobParams, validate({ body: schemas.statusBody }), async (req, res) => {
  res.json(jobs.jobDto(await jobs.setStatus(req.company, req.params.id, req.body.status, req.user), req.company))
})

recruiterRouter.delete('/:id', jobParams, async (req, res) => {
  await jobs.deleteJob(req.company, req.params.id)
  res.status(204).end()
})

// §3.22, P11c-Q15: the list needs Recruiter Plus; the count on the job stays.
recruiterRouter.get('/:id/relevant-talent', jobParams, requireDiscovery, async (req, res) => {
  res.json(await relevantTalent(req.user, req.company, req.params.id))
})

export const skillsRouter = Router()
skillsRouter.use(requireAuth, requireApprovedRecruiter)

skillsRouter.get('/suggestions', validate({ query: schemas.suggestionsQuery }), async (req, res) => {
  const items = await jobs.skillSuggestions(req.company, req.query.q)
  res.json({ items, total: items.length, page: 1, pageSize: items.length })
})

export const candidateRouter = Router()
candidateRouter.use(requireAuth, requireRole('candidate'))

candidateRouter.get('/', validate({ query: schemas.searchQuery }), async (req, res) => {
  res.json(await search.searchJobs(req.user, req.query))
})

candidateRouter.get('/recommended', async (req, res) => {
  res.json(await search.recommendedJobs(req.user))
})

candidateRouter.get('/:id', jobParams, async (req, res) => {
  res.json(await search.jobDetails(req.user, req.params.id))
})

export const savedRouter = Router()
savedRouter.use(requireAuth, requireRole('candidate'))
const savedParams = validate({ params: z.object({ jobId: objectId }) })

savedRouter.get('/', async (req, res) => {
  res.json(await search.savedJobs(req.user))
})

savedRouter.put('/:jobId', savedParams, async (req, res) => {
  await search.saveJob(req.user, req.params.jobId)
  res.json({ saved: true })
})

savedRouter.delete('/:jobId', savedParams, async (req, res) => {
  await search.unsaveJob(req.user, req.params.jobId)
  res.json({ saved: false })
})

/* /admin/jobs (M-046, P10-Q4): every status with filters and pages; "Open case" also needs moderation.manage (M-164). */
export const adminRouter = Router()
adminRouter.get('/', requireAuth, requireRole('admin'), requirePermission('jobs.view'), validate({ query: schemas.adminJobsQuery }), async (req, res) => {
  res.json(await jobs.adminJobs(req.user, req.query))
})

adminRouter.post(
  '/:id/case',
  requireAuth,
  requireRole('admin'),
  requirePermission('jobs.view'),
  requirePermission('moderation.manage'),
  jobParams,
  validate({ body: caseBody }),
  async (req, res) => {
    const opened = await openJobCase(req.user, req.params.id, req.body)
    res.status(opened.created ? 201 : 200).json(opened)
  },
)
