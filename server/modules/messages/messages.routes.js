import { HIRING_ROLES, isHiring } from '../../config/enums.js'
import { Router } from 'express'
import mongoose from 'mongoose'
import { validate } from '../../lib/validate.js'
import { requireApprovedRecruiter, requireAuth, requireRole } from '../../middleware/auth.js'
import { requireEntitlement } from '../../middleware/entitlements.js'
import { AgencyMembership } from '../agencies/agencies.model.js'
import * as schemas from './messages.schemas.js'
import * as messages from './messages.service.js'

/*
 * /conversations for candidates and approved recruiters (§5). Sending needs `message_send` for candidates (M-084, M-118);
 * a recruiter needs `outreach` (Recruiter Plus) only to start one and replies on Free (§3.22, P11c-Q14). Suggested
 * replies are an AI feature: `ai` (Plus, Recruiter Plus) and, for candidates, `message_send`.
 */
const router = Router()
const idParams = validate({ params: schemas.idParams })

// 2026-11-23 (owner): an agency starts a chat with someone on its books on any plan; anyone else needs `outreach`.
const outreach = requireEntitlement('outreach', HIRING_ROLES)
async function outreachUnlessOnBooks(req, res, next) {
  const candidateId = req.body?.candidateId
  if (req.user.role === 'agency' && mongoose.isValidObjectId(candidateId) && (await AgencyMembership.exists({ companyId: req.company._id, candidateId, status: 'active' }))) return next()
  return outreach(req, res, next)
}

router.use(requireAuth, requireRole('candidate', ...HIRING_ROLES), (req, res, next) => (isHiring(req.user.role) ? requireApprovedRecruiter(req, res, next) : next()))

router.get('/', async (req, res) => {
  res.json(await messages.listConversations(req.user, req.company))
})

router.post('/', requireEntitlement('message_send'), outreachUnlessOnBooks, validate({ body: schemas.startBody }), async (req, res) => {
  res.status(201).json(await messages.start(req.user, req.company, req.body))
})

router.get('/:id/messages', idParams, async (req, res) => {
  res.json(await messages.getMessages(req.user, req.company, req.params.id))
})

router.post('/:id/messages', idParams, requireEntitlement('message_send'), validate({ body: schemas.messageBody }), async (req, res) => {
  res.status(201).json(await messages.send(req.user, req.company, req.params.id, req.body.body))
})

router.get('/:id/reply-suggestions', idParams, requireEntitlement('ai', ['candidate', ...HIRING_ROLES]), requireEntitlement('message_send'), async (req, res) => {
  res.json(await messages.replySuggestions(req.user, req.company, req.params.id))
})

router.post('/:id/read', idParams, async (req, res) => {
  await messages.markRead(req.user, req.company, req.params.id)
  res.status(204).end()
})

export default router
