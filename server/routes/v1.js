import { Router } from 'express'
import { config } from '../config/env.js'
import { dbStatus } from '../lib/db.js'
import adminRoutes from '../modules/admin/admin.routes.js'
import authRoutes from '../modules/auth/auth.routes.js'
import candidateRoutes from '../modules/candidates/candidates.routes.js'
import * as companyRoutes from '../modules/companies/companies.routes.js'
import cvRoutes from '../modules/cv/cv.routes.js'
import * as discoveryRoutes from '../modules/discovery/discovery.routes.js'
import filesRoutes from '../modules/files/files.routes.js'
import * as jobRoutes from '../modules/jobs/jobs.routes.js'
import metaRoutes from '../modules/meta/meta.routes.js'
import * as paymentRoutes from '../modules/payments/payments.routes.js'
import placesRoutes from '../modules/places/places.routes.js'
import usersRoutes from '../modules/users/users.routes.js'
import * as verificationRoutes from '../modules/verification/verification.routes.js'

const router = Router()

router.get('/health', (req, res) => {
  res.json({ status: 'ok', db: dbStatus() })
})

router.use('/auth', authRoutes)
router.use('/me/payments', paymentRoutes.myPaymentsRouter)
router.use('/me', usersRoutes)
router.use(metaRoutes)
router.use('/places', placesRoutes)
router.use('/payments', paymentRoutes.paymentsRouter)
router.use('/files', filesRoutes)
// Narrower mounts first: each module router checks the session for everything under its path.
router.use('/candidate/cv', cvRoutes)
router.use('/candidate/verification', verificationRoutes.candidateRouter)
router.use('/candidate/saved-jobs', jobRoutes.savedRouter)
router.use('/candidate/subscription', paymentRoutes.subscriptionRouter)
router.use('/candidate', candidateRoutes)
router.use('/jobs', jobRoutes.candidateRouter)
router.use('/recruiter/onboarding', companyRoutes.onboardingRouter)
router.use('/recruiter/company', companyRoutes.companyRouter)
router.use('/recruiter/jobs', jobRoutes.recruiterRouter)
router.use('/recruiter/candidates', discoveryRoutes.candidatesRouter)
router.use('/recruiter/shortlist', discoveryRoutes.shortlistRouter)
router.use('/recruiter/overview', discoveryRoutes.overviewRouter)
router.use('/skills', jobRoutes.skillsRouter)
router.use('/admin/moderation/verification', verificationRoutes.adminRouter)
router.use('/admin/moderation/accounts', companyRoutes.adminRouter)
router.use('/admin', adminRoutes)

// Test-only helpers (§2.13), never mounted outside NODE_ENV=test.
if (config.isTest) router.use('/_test', (await import('../test/testRouter.js')).default)

export default router
