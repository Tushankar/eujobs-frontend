import { Router } from 'express'
import { config } from '../config/env.js'
import { dbStatus } from '../lib/db.js'
import adminRoutes from '../modules/admin/admin.routes.js'
import * as aiRoutes from '../modules/ai/ai.routes.js'
import alertRoutes from '../modules/alerts/alerts.routes.js'
import * as applicationRoutes from '../modules/applications/applications.routes.js'
import authRoutes from '../modules/auth/auth.routes.js'
import * as blogRoutes from '../modules/blog/blog.routes.js'
import candidateRoutes from '../modules/candidates/candidates.routes.js'
import * as companyRoutes from '../modules/companies/companies.routes.js'
import cvRoutes from '../modules/cv/cv.routes.js'
import * as discoveryRoutes from '../modules/discovery/discovery.routes.js'
import filesRoutes from '../modules/files/files.routes.js'
import * as interviewRoutes from '../modules/interviews/interviews.routes.js'
import * as jobRoutes from '../modules/jobs/jobs.routes.js'
import * as learningRoutes from '../modules/learning/learning.routes.js'
import * as matchingRoutes from '../modules/matching/matching.routes.js'
import messagesRoutes from '../modules/messages/messages.routes.js'
import * as moderationRoutes from '../modules/moderation/moderation.routes.js'
import notificationRoutes from '../modules/notifications/notifications.routes.js'
import landingRoutes from '../modules/landing/landing.routes.js'
import metaRoutes from '../modules/meta/meta.routes.js'
import * as newsletterRoutes from '../modules/newsletter/newsletter.routes.js'
import * as paymentRoutes from '../modules/payments/payments.routes.js'
import placesRoutes from '../modules/places/places.routes.js'
import privacyRoutes from '../modules/privacy/privacy.routes.js'
import * as reviewRoutes from '../modules/reviews/reviews.routes.js'
import usersRoutes from '../modules/users/users.routes.js'
import * as verificationRoutes from '../modules/verification/verification.routes.js'

const router = Router()

/** Every admin router, in mount order. The permission matrix test (M-155) walks this table. */
export const ADMIN_MOUNTS = [
  ['/admin/courses', learningRoutes.adminCoursesRouter],
  ['/admin', learningRoutes.adminToolsRouter],
  ['/admin/matching', matchingRoutes.adminMatchingRouter],
  ['/admin/jobs', jobRoutes.adminRouter],
  ['/admin/jobs', aiRoutes.adminRouter],
  ['/admin/ai', matchingRoutes.adminAiRouter],
  ['/admin/moderation/verification', verificationRoutes.adminRouter],
  ['/admin/moderation/accounts', companyRoutes.adminRouter],
  ['/admin/moderation/reviews', reviewRoutes.adminRouter],
  ['/admin/moderation', moderationRoutes.adminRouter],
  ['/admin/payments', paymentRoutes.adminRouter],
  ['/admin/content/blog', blogRoutes.adminRouter],
  ['/admin/content/subscribers', newsletterRoutes.adminRouter],
  ['/admin', adminRoutes],
]

router.get('/health', (req, res) => {
  res.json({ status: 'ok', db: dbStatus() })
})

router.use('/auth', authRoutes)
router.use('/me/payments', paymentRoutes.myPaymentsRouter)
router.use('/me/review', reviewRoutes.ownRouter)
router.use('/me', privacyRoutes)
router.use('/me', usersRoutes)
router.use('/landing', landingRoutes)
router.use('/blog', blogRoutes.publicRouter)
router.use('/newsletter', newsletterRoutes.publicRouter)
router.use(metaRoutes)
router.use('/places', placesRoutes)
router.use('/payments', paymentRoutes.paymentsRouter)
router.use('/files', filesRoutes)
// Narrower mounts first: each module router checks the session for everything under its path.
router.use('/candidate/cv', cvRoutes)
router.use('/candidate/applications', applicationRoutes.candidateRouter)
router.use('/candidate/verification', verificationRoutes.candidateRouter)
router.use('/candidate/saved-jobs', jobRoutes.savedRouter)
router.use('/candidate/job-alerts', alertRoutes)
router.use('/candidate/subscription', paymentRoutes.subscriptionRouter)
router.use('/candidate/insights', aiRoutes.insightsRouter)
router.use('/candidate', aiRoutes.candidateRouter)
router.use('/candidate', candidateRoutes)
router.use('/jobs', aiRoutes.jobSummaryRouter)
router.use('/jobs', jobRoutes.candidateRouter)
router.use('/translate', aiRoutes.translateRouter)
router.use('/recruiter/onboarding', companyRoutes.onboardingRouter)
router.use('/recruiter/company', companyRoutes.companyRouter)
router.use('/recruiter/subscription', paymentRoutes.subscriptionRouter)
router.use('/recruiter/jobs', jobRoutes.recruiterRouter)
router.use('/recruiter/candidates', aiRoutes.recruiterRouter)
router.use('/recruiter/candidates', discoveryRoutes.candidatesRouter)
router.use('/recruiter/shortlist', discoveryRoutes.shortlistRouter)
router.use('/recruiter/overview', discoveryRoutes.overviewRouter)
router.use('/recruiter/overview', applicationRoutes.overviewRouter)
router.use('/recruiter/applications', applicationRoutes.recruiterRouter)
router.use('/recruiter/pipeline', applicationRoutes.pipelineRouter)
router.use('/skills', jobRoutes.skillsRouter)
router.use('/conversations', messagesRoutes)
router.use('/interviews', interviewRoutes.interviewsRouter)
router.use('/document-requests', interviewRoutes.documentsRouter)
router.use('/reports', moderationRoutes.reportsRouter)
router.use('/notifications', notificationRoutes)
router.use('/courses', learningRoutes.coursesRouter)
router.use('/learning', learningRoutes.learningRouter)
router.use('/public/certificates', learningRoutes.publicCertificatesRouter)
for (const [path, adminRouter] of ADMIN_MOUNTS) router.use(path, adminRouter)

// Test-only helpers (§2.13), never mounted outside NODE_ENV=test.
if (config.isTest) router.use('/_test', (await import('../test/testRouter.js')).default)

export default router
