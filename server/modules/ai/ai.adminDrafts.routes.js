import { Router } from 'express'
import { z } from 'zod'
import { ENUMS } from '../../config/enums.js'
import { LIMITS } from '../../config/limits.js'
import { objectId, validate } from '../../lib/validate.js'
import { requireAuth, requireRole } from '../../middleware/auth.js'
import { requirePermission } from '../../middleware/permissions.js'
import * as drafts from './ai.adminDrafts.js'

/*
 * /admin/ai-drafts (owner 2026-11-17, phase 4): the admin helpers, each behind the permission of the screen it serves.
 * Admins are never counted toward AI credits.
 */
const C = LIMITS.course
const B = LIMITS.blog

const idParams = validate({ params: z.object({ id: objectId }) })
const courseDetailsBody = z.object({
  title: z.string().trim().max(C.title.max).default(''),
  category: z.string().trim().max(C.category.max).default(''),
  level: z.enum(ENUMS.courseLevel).nullable().optional(),
})
const quizBody = z.object({ count: z.number().int().min(1).max(C.quiz.questions.max).default(5) })
const blogBody = z.object({
  title: z.string().trim().min(B.title.min).max(B.title.max),
  points: z.string().trim().min(3).max(2000),
})

export const adminDraftsRouter = Router()
adminDraftsRouter.use(requireAuth, requireRole('admin'))

const learning = requirePermission('learning.manage')
const moderation = requirePermission('moderation.manage')

adminDraftsRouter.post('/courses/:id/details', learning, idParams, validate({ body: courseDetailsBody }), async (req, res) => {
  res.json(await drafts.courseDetails(req.user, req.params.id, req.body))
})

adminDraftsRouter.post('/courses/:id/quiz-questions', learning, idParams, validate({ body: quizBody }), async (req, res) => {
  res.json(await drafts.quizQuestions(req.user, req.params.id, req.body))
})

adminDraftsRouter.post('/moderation/cases/:id/triage', moderation, idParams, async (req, res) => {
  res.json(await drafts.reportTriage(req.user, req.params.id))
})

adminDraftsRouter.post('/moderation/accounts/:userId/summary', moderation, validate({ params: z.object({ userId: objectId }) }), async (req, res) => {
  res.json(await drafts.accountSummary(req.user, req.params.userId))
})

adminDraftsRouter.post('/blog-draft', requirePermission('content.manage'), validate({ body: blogBody }), async (req, res) => {
  res.json(await drafts.blogDraft(req.user, req.body))
})
