import { Router } from 'express'
import { HIRING_ROLES } from '../../config/enums.js'
import { requireAuth, requireRole } from '../../middleware/auth.js'
import { failedLoginsPerEmail, forgotPasswordPerEmail, loginsPerIp, loginStepsPerIp, signUpsPerIp, verifyResendPerIp } from '../../middleware/rateLimit.js'
import { validate } from '../../lib/validate.js'
import { acceptInvite, inviteDetails } from '../admin/admin.access.js'
import { meDto } from '../users/users.service.js'
import * as schemas from './auth.schemas.js'
import * as auth from './auth.service.js'
import * as loginStep from './login.service.js'
import * as sessions from './sessions.service.js'

const router = Router()

// A browser that proved the account's email is remembered; admins enter their app code every time, so theirs is not.
const rememberBrowser = async (user) => (user.role === 'admin' ? undefined : (await loginStep.trustBrowser(user)).deviceToken)

router.post('/candidate/register', signUpsPerIp, validate({ body: schemas.candidateRegisterBody }), async (req, res) => {
  await auth.registerCandidate(req.body)
  res.status(201).json({ email: req.body.email })
})

/** Recruiters and (2026-11-20) agencies sign up the same way; the account starts at the email code. */
const registerHiring = (role) => async (req, res) => {
  const user = await auth.registerRecruiter(req.body, role)
  // The browser that created the account is remembered (2026-11-18).
  const { deviceToken, deviceId } = await loginStep.trustBrowser(user)
  res.status(201).json({ token: await sessions.startSession(user, req, { deviceId }), me: await meDto(user), deviceToken })
}

router.post('/recruiter/register', signUpsPerIp, validate({ body: schemas.recruiterRegisterBody }), registerHiring('recruiter'))
router.post('/agency/register', signUpsPerIp, validate({ body: schemas.agencyRegisterBody }), registerHiring('agency'))

router.post('/login', loginsPerIp, failedLoginsPerEmail, validate({ body: schemas.loginBody }), async (req, res) => {
  const user = await auth.login(req.body).catch(async (error) => {
    if (error.code === 'INVALID_CREDENTIALS') await sessions.recordFailedSignIn(req.body.email, req)
    throw error
  })
  res.json(await loginStep.beginLogin(user, req, req.body.deviceToken))
})

// 2026-11-18: the second step after a correct password (login.service.js).
router.post('/login/verify', loginStepsPerIp, validate({ body: schemas.loginVerifyBody }), async (req, res) => {
  res.json(await loginStep.verifyLogin(req.body.challenge, req.body.code, req))
})

router.post('/login/resend', loginStepsPerIp, validate({ body: schemas.challengeBody }), async (req, res) => {
  await loginStep.resendLoginCode(req.body.challenge, req)
  res.status(204).end()
})

router.post('/login/setup', loginStepsPerIp, validate({ body: schemas.challengeBody }), async (req, res) => {
  res.json(await loginStep.loginSetup(req.body.challenge))
})

// 2026-11-18: signing out ends this device's session, so it leaves the account's device list.
router.post('/logout', requireAuth, async (req, res) => {
  await sessions.endSession(req.sessionId)
  res.status(204).end()
})

// The browser that opened the emailed link proved the address, so it is remembered (2026-11-18).
router.post('/verify-email', validate({ body: schemas.tokenBody }), async (req, res) => {
  const user = await auth.verifyEmailLink(req.body.token)
  res.json({ role: user.role, deviceToken: await rememberBrowser(user) })
})

router.post('/verify-email/resend', verifyResendPerIp, validate({ body: schemas.emailBody }), async (req, res) => {
  await auth.resendVerifyEmail(req.body.email)
  res.status(202).end()
})

router.post('/email-code/verify', requireAuth, requireRole(...HIRING_ROLES), validate({ body: schemas.codeBody }), async (req, res) => {
  await auth.verifyRecruiterEmailCode(req.user, req.body.code)
  res.json(await meDto(req.user))
})

router.post('/email-code/resend', requireAuth, requireRole(...HIRING_ROLES), async (req, res) => {
  await auth.resendRecruiterEmailCode(req.user)
  res.status(202).end()
})

router.post('/forgot-password', forgotPasswordPerEmail, validate({ body: schemas.emailBody }), async (req, res) => {
  await auth.forgotPassword(req.body.email)
  res.status(202).end()
})

router.post('/reset-password', validate({ body: schemas.resetBody }), async (req, res) => {
  const user = await auth.resetPassword(req.body.token, req.body.password)
  res.json({ role: user.role, deviceToken: await rememberBrowser(user) })
})

// U21: the invite link opens /admin/set-password, which checks the token, then sets the password once.
router.get('/invite/:token', async (req, res) => {
  res.json(await inviteDetails(req.params.token))
})

router.post('/invite/accept', validate({ body: schemas.resetBody }), async (req, res) => {
  res.json(await acceptInvite(req.body.token, req.body.password))
})

export default router
