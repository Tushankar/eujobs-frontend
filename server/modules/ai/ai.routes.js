import { Router } from 'express'
import { validate } from '../../lib/validate.js'
import { requireApprovedRecruiter, requireAuth, requireRole } from '../../middleware/auth.js'
import { requireEntitlement } from '../../middleware/entitlements.js'
import { requirePermission } from '../../middleware/permissions.js'
import * as insights from './ai.insights.js'
import * as schemas from './ai.schemas.js'
import * as summaries from './ai.summaries.js'
import { translate } from './ai.translate.js'

/*
 * AI routes (§5, §3.18). Candidates need the `ai` entitlement (402 PLAN_REQUIRED otherwise, M-118); approved recruiters
 * use the AI for free (M-117); admins need the route's permission. Generations count toward the daily cap (OD13).
 */
const ai = requireEntitlement('ai')
/** A Plus candidate or an approved recruiter (C+ai, R✓). */
const reader = [
  requireAuth,
  requireRole('candidate', 'recruiter'),
  (req, res, next) => (req.user.role === 'recruiter' ? requireApprovedRecruiter(req, res, next) : ai(req, res, next)),
]
const jobParams = validate({ params: schemas.jobParams })
const jobQuery = validate({ query: schemas.jobQuery })

/* /candidate/insights: the AI insights pages (M-057, M-063 … M-067). */
export const insightsRouter = Router()
insightsRouter.use(requireAuth, requireRole('candidate'), ai)

insightsRouter.get('/overview', async (req, res) => {
  res.json(await insights.overview(req.user))
})

insightsRouter.get('/roles', async (req, res) => {
  res.json(await insights.roles(req.user))
})

for (const [path, page] of [
  ['/skill-gap', insights.skillGap],
  ['/job-match', insights.jobMatch],
  ['/why-recommended', insights.whyRecommended],
]) {
  insightsRouter.get(path, jobQuery, async (req, res) => {
    res.json(await page(req.user, req.query.jobId))
  })
}

insightsRouter.get('/improve-profile', async (req, res) => {
  res.json(await insights.improveProfile(req.user))
})

insightsRouter.get('/narrative', validate({ query: schemas.narrativeQuery }), async (req, res) => {
  res.json(await insights.narrative(req.user, req.query))
})

insightsRouter.put('/feedback/:jobId', validate({ params: schemas.feedbackParams, body: schemas.feedbackBody }), async (req, res) => {
  await insights.saveFeedback(req.user, req.params.jobId, req.body.value)
  res.status(204).end()
})

/* Candidate profile actions of the AI pages: "I have this skill" (M-064), the learning plan (P9-Q2), the AI summary (M-062). */
export const candidateRouter = Router()
const candidate = [requireAuth, requireRole('candidate'), ai]
const skillBody = validate({ body: schemas.skillBody })
const skillParams = validate({ params: schemas.skillParams })

candidateRouter.post('/profile/skills', ...candidate, skillBody, async (req, res) => {
  res.status(201).json(await insights.addProfileSkill(req.user, req.body.skill))
})

candidateRouter.delete('/profile/skills/:skill', ...candidate, skillParams, async (req, res) => {
  res.json(await insights.removeProfileSkill(req.user, req.params.skill))
})

candidateRouter.post('/profile/ai-summary', ...candidate, async (req, res) => {
  res.json(await summaries.profileSummary(req.user))
})

candidateRouter.put('/learning-plan/:skill', ...candidate, skillParams, async (req, res) => {
  res.json(await insights.addPlanSkill(req.user, req.params.skill))
})

// Removing stays possible on Free, as deleting an alert does (P7-Q2).
candidateRouter.delete('/learning-plan/:skill', requireAuth, requireRole('candidate'), skillParams, async (req, res) => {
  res.json(await insights.removePlanSkill(req.user, req.params.skill))
})

/* POST /jobs/:id/ai-summary (M-058, M-059): a Plus candidate's visible job or an approved recruiter's own job. */
export const jobSummaryRouter = Router()
jobSummaryRouter.post('/:id/ai-summary', ...reader, jobParams, async (req, res) => {
  res.json(await summaries.jobSummary(req.user, req.params.id, { company: req.company }))
})

/* GET /recruiter/candidates/:id/match (M-057): the narrative of Match insights; never a score (C6). */
export const recruiterRouter = Router()
recruiterRouter.get('/:id/match', requireAuth, requireApprovedRecruiter, jobParams, validate({ query: schemas.feedbackParams }), async (req, res) => {
  res.json(await summaries.recruiterMatch(req.user, req.company, req.params.id, req.query.jobId))
})

/* /admin/jobs/:id/ai-summary (M-058): the admin's language; Regenerate replaces the cached text and is not counted (U3). */
export const adminRouter = Router()
const jobsView = [requireAuth, requireRole('admin'), requirePermission('jobs.view')]

adminRouter.get('/:id/ai-summary', ...jobsView, jobParams, async (req, res) => {
  res.json(await summaries.jobSummary(req.user, req.params.id))
})

adminRouter.post('/:id/ai-summary/regenerate', ...jobsView, jobParams, async (req, res) => {
  res.json(await summaries.jobSummary(req.user, req.params.id, { regenerate: true }))
})

/* POST /translate (M-144). */
export const translateRouter = Router()
translateRouter.post('/', ...reader, validate({ body: schemas.translateBody }), async (req, res) => {
  res.json(await translate(req.user, req.company, req.body))
})
