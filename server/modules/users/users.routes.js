import { Router } from 'express'
import { requireAuth, requireRole, requireVerifiedEmail } from '../../middleware/auth.js'
import { validate } from '../../lib/validate.js'
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

router.post('/password', requireVerifiedEmail, validate({ body: schemas.passwordChangeBody }), async (req, res) => {
  await users.changePassword(req.user, req.body)
  res.status(204).end()
})

router.post('/legal/accept', requireVerifiedEmail, async (req, res) => {
  await users.acceptLegal(req.user)
  res.json(await users.meDto(req.user))
})

// No in-app toggle and no admin email preferences (OD6): candidates and recruiters only.
router.patch(
  '/notifications',
  requireVerifiedEmail,
  requireRole('candidate', 'recruiter'),
  validate({ body: schemas.notificationsBody }),
  async (req, res) => {
    req.user.notifyEmail = req.body.notifyEmail
    await req.user.save()
    res.json(await users.meDto(req.user))
  },
)

export default router
