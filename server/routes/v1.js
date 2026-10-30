import { Router } from 'express'
import { config } from '../config/env.js'
import { dbStatus } from '../lib/db.js'
import adminRoutes from '../modules/admin/admin.routes.js'
import authRoutes from '../modules/auth/auth.routes.js'
import candidateRoutes from '../modules/candidates/candidates.routes.js'
import cvRoutes from '../modules/cv/cv.routes.js'
import filesRoutes from '../modules/files/files.routes.js'
import metaRoutes from '../modules/meta/meta.routes.js'
import placesRoutes from '../modules/places/places.routes.js'
import usersRoutes from '../modules/users/users.routes.js'
import * as verificationRoutes from '../modules/verification/verification.routes.js'

const router = Router()

router.get('/health', (req, res) => {
  res.json({ status: 'ok', db: dbStatus() })
})

router.use('/auth', authRoutes)
router.use('/me', usersRoutes)
router.use(metaRoutes)
router.use('/places', placesRoutes)
router.use('/files', filesRoutes)
// Narrower mounts first: each module router checks the session for everything under its path.
router.use('/candidate/cv', cvRoutes)
router.use('/candidate/verification', verificationRoutes.candidateRouter)
router.use('/candidate', candidateRoutes)
router.use('/admin/moderation/verification', verificationRoutes.adminRouter)
router.use('/admin', adminRoutes)

// Test-only helpers (§2.13), never mounted outside NODE_ENV=test.
if (config.isTest) router.use('/_test', (await import('../test/testRouter.js')).default)

export default router
