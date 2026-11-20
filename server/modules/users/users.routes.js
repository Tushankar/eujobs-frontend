import { HIRING_ROLES, isHiring } from '../../config/enums.js'
import { Router } from 'express'
import { requireApprovedRecruiter, requireAuth, requireVerifiedEmail } from '../../middleware/auth.js'
import { z } from 'zod'
import { objectId, validate } from '../../lib/validate.js'
import { switchesBody } from '../notifications/notifications.schemas.js'
import { setEmailSwitches } from '../notifications/notifications.service.js'
import * as sessions from '../auth/sessions.service.js'
import * as twoFactor from '../auth/twoFactor.service.js'
import * as schemas from './users.schemas.js'
import { markCelebrationSeen } from './celebrations.js'
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
  (req, res, next) => (isHiring(req.user.role) ? requireApprovedRecruiter(req, res, next) : next()),
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

// 2026-11-17: a success modal was seen; it is not shown again.
router.post('/celebrations/:id/seen', validate({ params: z.object({ id: objectId }) }), async (req, res) => {
  await markCelebrationSeen(req.user, req.params.id)
  res.status(204).end()
})

router.post('/tour', async (req, res) => {
  if (!['candidate', ...HIRING_ROLES].includes(req.user.role)) return res.status(204).end()
  await users.finishTour(req.user)
  res.json(await users.meDto(req.user))
})

// 2026-11-18: signed-in devices and sign-in history (Settings › Data & account; admin Settings).
router.get('/sessions', async (req, res) => {
  res.json(await sessions.listSessions(req.user, req.sessionId))
})

router.delete('/sessions/:id', validate({ params: z.object({ id: objectId }) }), async (req, res) => {
  await sessions.revokeSession(req.user, req.params.id, req.sessionId)
  res.status(204).end()
})

// Answers this device's new token: the account's other tokens stop working.
router.post('/sessions/sign-out-others', async (req, res) => {
  res.json({ token: await sessions.revokeOtherSessions(req.user, req.sessionId) })
})

// 2026-11-18: authenticator-app 2FA. Setup answers the key and QR code; the first code turns it on and answers the
// one-time backup codes. Turning it off and new backup codes need the password; admins cannot turn it off.
const passwordBody = z.object({ password: z.string().min(1) })

router.post('/2fa/setup', async (req, res) => {
  res.json(await twoFactor.startSetup(req.user))
})

router.post('/2fa/enable', validate({ body: z.object({ code: z.string().trim().min(1).max(20) }) }), async (req, res) => {
  res.json(await twoFactor.enable(req.user, req.body.code))
})

router.post('/2fa/disable', validate({ body: passwordBody }), async (req, res) => {
  await twoFactor.disable(req.user, req.body.password)
  res.json(await users.meDto(req.user))
})

router.post('/2fa/backup-codes', validate({ body: passwordBody }), async (req, res) => {
  res.json(await twoFactor.regenerateBackupCodes(req.user, req.body.password))
})

// P11b-Q3, Q12: one email switch per category, for every role; in-app notifications are always on.
router.patch('/notifications', requireVerifiedEmail, validate({ body: switchesBody }), async (req, res) => {
  await setEmailSwitches(req.user, req.body.emailSwitches)
  res.json(await users.meDto(req.user))
})

export default router
