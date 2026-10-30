import { Router } from 'express'
import { requireAuth, requireRole } from '../../middleware/auth.js'
import { failedLoginsPerEmail, forgotPasswordPerEmail, loginsPerIp, signUpsPerIp } from '../../middleware/rateLimit.js'
import { validate } from '../../lib/validate.js'
import { meDto } from '../users/users.service.js'
import * as schemas from './auth.schemas.js'
import * as auth from './auth.service.js'

const router = Router()

router.post('/candidate/register', signUpsPerIp, validate({ body: schemas.candidateRegisterBody }), async (req, res) => {
  await auth.registerCandidate(req.body)
  res.status(201).json({ email: req.body.email })
})

router.post('/recruiter/register', signUpsPerIp, validate({ body: schemas.recruiterRegisterBody }), async (req, res) => {
  const user = await auth.registerRecruiter(req.body)
  res.status(201).json({ token: auth.signToken(user), me: await meDto(user) })
})

router.post('/login', loginsPerIp, failedLoginsPerEmail, validate({ body: schemas.loginBody }), async (req, res) => {
  const user = await auth.login(req.body)
  res.json({ token: auth.signToken(user), me: await meDto(user) })
})

router.post('/verify-email', validate({ body: schemas.tokenBody }), async (req, res) => {
  res.json(await auth.verifyEmailLink(req.body.token))
})

router.post('/verify-email/resend', validate({ body: schemas.emailBody }), async (req, res) => {
  await auth.resendVerifyEmail(req.body.email)
  res.status(202).end()
})

router.post('/email-code/verify', requireAuth, requireRole('recruiter'), validate({ body: schemas.codeBody }), async (req, res) => {
  await auth.verifyRecruiterEmailCode(req.user, req.body.code)
  res.json(await meDto(req.user))
})

router.post('/email-code/resend', requireAuth, requireRole('recruiter'), async (req, res) => {
  await auth.resendRecruiterEmailCode(req.user)
  res.status(202).end()
})

router.post('/forgot-password', forgotPasswordPerEmail, validate({ body: schemas.emailBody }), async (req, res) => {
  await auth.forgotPassword(req.body.email)
  res.status(202).end()
})

router.post('/reset-password', validate({ body: schemas.resetBody }), async (req, res) => {
  res.json(await auth.resetPassword(req.body.token, req.body.password))
})

export default router
