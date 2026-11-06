import { Router } from 'express'
import { requireApprovedRecruiter, requireAuth, requireVerifiedEmail } from '../../middleware/auth.js'
import { validate } from '../../lib/validate.js'
import { switchesBody } from '../notifications/notifications.schemas.js'
import { setEmailSwitches } from '../notifications/notifications.service.js'
import * as schemas from './users.schemas.js'
import * as users from './users.service.js'

const router = Router()

router.use(requireAuth)

router.get('/', async (req, res) => {
  res.json(await users.meDto(req.user))
})

router.patch('/', validate({ body: schemas.mePatchBody }), async (req, res) => {
  await users.updateMe(req.user, req.body)
  res.json(await users.meDto(req.user))
})

// M-094, P11b-Q2: one call for the badges, polled by the client: the candidate's active applications, unread messages
// (candidates and recruiters) and every role's unread notifications (the bell and the sidebar sections).
router.get(
  '/counters',
  (req, res, next) => (req.user.role === 'recruiter' ? requireApprovedRecruiter(req, res, next) : next()),
  async (req, res) => {
    res.json(await users.counters(req.user))
  },
)

router.post('/password', requireVerifiedEmail, validate({ body: schemas.passwordChangeBody }), async (req, res) => {
  await users.changePassword(req.user, req.body)
  res.status(204).end()
})

router.post('/legal/accept', requireVerifiedEmail, async (req, res) => {
  await users.acceptLegal(req.user)
  res.json(await users.meDto(req.user))
})

router.post('/tour', async (req, res) => {
  if (!['candidate', 'recruiter'].includes(req.user.role)) return res.status(204).end()
  await users.finishTour(req.user)
  res.json(await users.meDto(req.user))
})

// P11b-Q3, Q12: one email switch per category, for every role; in-app notifications are always on.
router.patch('/notifications', requireVerifiedEmail, validate({ body: switchesBody }), async (req, res) => {
  await setEmailSwitches(req.user, req.body.emailSwitches)
  res.json(await users.meDto(req.user))
})

export default router
