import { Router } from 'express'
import { validate } from '../../lib/validate.js'
import { requireAuth, requireRole } from '../../middleware/auth.js'
import { upload } from '../../middleware/upload.js'
import { meDto, updateMe } from '../users/users.service.js'
import * as schemas from './candidates.schemas.js'
import * as candidates from './candidates.service.js'

/* /candidate: profile sections, onboarding and privacy (§5). Every profile change answers with the full profile. */
const router = Router()

router.use(requireAuth, requireRole('candidate'))

async function withProfile(req, res, next) {
  req.profile = await candidates.loadProfile(req.user._id)
  next()
}

/** Runs a profile change, then answers with the updated profile. */
const change = (work) => async (req, res) => {
  await work(req)
  res.json(await candidates.profileDto(req.user, req.profile))
}

const entryParams = validate({ params: schemas.entryParams })

router.get('/profile', withProfile, async (req, res) => {
  res.json(await candidates.profileDto(req.user, req.profile))
})

router.put('/profile', validate({ body: schemas.profileBody }), withProfile, change((req) => candidates.updateProfile(req.user, req.profile, req.body)))

const ENTRY_BODIES = { 'work-history': schemas.workEntryBody, education: schemas.educationEntryBody }
for (const kind of candidates.ENTRY_KIND_PATHS) {
  const body = validate({ body: ENTRY_BODIES[kind] })
  router.post(`/profile/${kind}`, body, withProfile, change((req) => candidates.addEntry(req.user, req.profile, kind, req.body)))
  router.put(`/profile/${kind}/none`, validate({ body: schemas.noneBody }), withProfile, change((req) => candidates.setNone(req.user, req.profile, kind, req.body.none)))
  router.patch(`/profile/${kind}/:id`, entryParams, body, withProfile, change((req) => candidates.updateEntry(req.user, req.profile, kind, req.params.id, req.body)))
  router.delete(`/profile/${kind}/:id`, entryParams, withProfile, change((req) => candidates.deleteEntry(req.user, req.profile, kind, req.params.id)))
}

router.put('/profile/languages', validate({ body: schemas.languagesBody }), withProfile, change((req) => candidates.setLanguages(req.user, req.profile, req.body)))
router.put('/profile/right-to-work', validate({ body: schemas.rightToWorkBody }), withProfile, change((req) => candidates.setRightToWork(req.user, req.profile, req.body)))
router.put('/profile/links', validate({ body: schemas.linksBody }), withProfile, change((req) => candidates.setLinks(req.user, req.profile, req.body)))

router.post('/profile/photo', upload('photo'), withProfile, change((req) => candidates.setPhoto(req.user, req.profile, req.file)))
router.delete('/profile/photo', withProfile, change((req) => candidates.removePhoto(req.user, req.profile)))

const certificateBody = validate({ body: schemas.certificateBody })
router.post('/profile/certificates', certificateBody, withProfile, change((req) => candidates.addCertificate(req.user, req.profile, req.body)))
router.patch('/profile/certificates/:id', entryParams, certificateBody, withProfile, change((req) => candidates.updateCertificate(req.user, req.profile, req.params.id, req.body)))
router.delete('/profile/certificates/:id', entryParams, withProfile, change((req) => candidates.deleteCertificate(req.user, req.profile, req.params.id)))
router.put('/profile/certificates/:id/file', entryParams, upload('certificate_file'), withProfile, change((req) => candidates.setCertificateFile(req.user, req.profile, req.params.id, req.file)))
router.delete('/profile/certificates/:id/file', entryParams, withProfile, change((req) => candidates.removeCertificateFile(req.user, req.profile, req.params.id)))

router.get('/profile/completeness', async (req, res) => {
  res.json((await candidates.candidateSummary(req.user)).completeness)
})

router.put('/onboarding/preferences', validate({ body: schemas.preferencesBody }), withProfile, change((req) => candidates.savePreferences(req.user, req.profile, req.body)))

/** M-014, M-136: ends onboarding; the header country takes the profile country (language per M-134). */
router.post('/onboarding/complete', withProfile, async (req, res) => {
  const countryCode = await candidates.completeOnboarding(req.user, req.profile)
  await updateMe(req.user, { pickerCountry: countryCode })
  res.json(await meDto(req.user))
})

router.get('/settings/privacy', (req, res) => {
  res.json(candidates.privacyDto(req.user))
})

router.patch('/settings/privacy', validate({ body: schemas.privacyBody }), async (req, res) => {
  await candidates.updatePrivacy(req.user, req.body)
  res.json(candidates.privacyDto(req.user))
})

export default router
