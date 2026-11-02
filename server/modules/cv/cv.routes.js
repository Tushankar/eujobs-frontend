import { Router } from 'express'
import { z } from 'zod'
import { objectId, validate } from '../../lib/validate.js'
import { requireAuth, requireRole } from '../../middleware/auth.js'
import { upload } from '../../middleware/upload.js'
import * as cv from './cv.service.js'

/* /candidate/cv (§5). Every change answers with the version list. */
const router = Router()
const versionParams = validate({ params: z.object({ id: objectId }) })

router.use(requireAuth, requireRole('candidate'))

router.get('/', async (req, res) => {
  res.json(await cv.listVersions(req.user))
})

router.post('/versions', upload('cv'), async (req, res) => {
  await cv.uploadVersion(req.user, req.file)
  res.status(201).json(await cv.listVersions(req.user))
})

router.post('/versions/:id/live', versionParams, async (req, res) => {
  await cv.makeLive(req.user, req.params.id)
  res.json(await cv.listVersions(req.user))
})

router.get('/versions/:id/download', versionParams, async (req, res) => {
  res.json(await cv.downloadUrl(req.user, req.params.id))
})

router.delete('/versions/:id', versionParams, async (req, res) => {
  await cv.deleteVersion(req.user, req.params.id)
  res.json(await cv.listVersions(req.user))
})

router.get('/requests', async (req, res) => {
  res.json(await cv.listRequests(req.user))
})

const decisionBody = z.object({ decision: z.enum(['approved', 'declined']), versionId: objectId.optional() })
router.post('/requests/:id/decision', versionParams, validate({ body: decisionBody }), async (req, res) => {
  await cv.decideRequest(req.user, req.params.id, req.body)
  res.json(await cv.listRequests(req.user))
})

router.get('/downloads', async (req, res) => {
  res.json(await cv.listDownloads(req.user))
})

export default router
