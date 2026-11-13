import { Router } from 'express'
import { z } from 'zod'
import { ENUMS } from '../../config/enums.js'
import { LIMITS } from '../../config/limits.js'
import { objectId, validate } from '../../lib/validate.js'
import { requireApprovedRecruiter, requireAuth, requireRole } from '../../middleware/auth.js'
import { requirePermission } from '../../middleware/permissions.js'
import * as reviews from './reviews.service.js'

const { text } = LIMITS.review
const reviewBody = z.object({ rating: z.number().int().min(1).max(5), text: z.string().trim().min(text.min).max(text.max) })

/* /me/review: an active candidate's or approved recruiter's own review. */
export const ownRouter = Router()
ownRouter.use(requireAuth, requireRole('candidate', 'recruiter'), (req, res, next) => (req.user.role === 'recruiter' ? requireApprovedRecruiter(req, res, next) : next()))

ownRouter.get('/', async (req, res) => {
  res.json(await reviews.getOwn(req.user))
})

ownRouter.put('/', validate({ body: reviewBody }), async (req, res) => {
  res.json(await reviews.saveOwn(req.user, req.body))
})

ownRouter.delete('/', async (req, res) => {
  res.json(await reviews.deleteOwn(req.user))
})

/* /admin/moderation/reviews (`moderation.manage`). */
export const adminRouter = Router()
adminRouter.use(requireAuth, requireRole('admin'), requirePermission('moderation.manage'))

adminRouter.get('/', validate({ query: z.object({ status: z.enum(ENUMS.reviewStatus).default('pending') }) }), async (req, res) => {
  res.json(await reviews.listForAdmin(req.query.status))
})

const decisionBody = z.object({ action: z.enum(['approve', 'reject']), reason: z.string().trim().max(LIMITS.moderationReason.max).default('') })

adminRouter.post('/:id/decision', validate({ params: z.object({ id: objectId }), body: decisionBody }), async (req, res) => {
  res.json(await reviews.decide(req.user, req.params.id, req.body))
})
