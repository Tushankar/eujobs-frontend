import { Router } from 'express'
import { validate } from '../../lib/validate.js'
import { requireApprovedRecruiter, requireAuth, requireRole, requireVerifiedEmail } from '../../middleware/auth.js'
import { requirePermission } from '../../middleware/permissions.js'
import { upload } from '../../middleware/upload.js'
import { phoneCodeBody, phoneConfirmBody } from '../verification/verification.schemas.js'
import { confirmPhone, requestPhoneCode } from '../verification/verification.service.js'
import * as review from './companies.review.js'
import * as schemas from './companies.schemas.js'
import * as companies from './companies.service.js'

/* /recruiter/onboarding, /recruiter/company and /admin/moderation/accounts (§5). */

/** Onboarding is open from the email code onward (U37); every change answers with the onboarding state. */
export const onboardingRouter = Router()
onboardingRouter.use(requireAuth, requireRole('recruiter'), requireVerifiedEmail)

const answer = (work, status = 200) => async (req, res) => {
  await work(req)
  res.status(status).json(await companies.onboardingDto(req.user))
}

onboardingRouter.get('/', answer(() => {}))
onboardingRouter.put('/account', validate({ body: schemas.accountBody }), answer((req) => companies.updateAccount(req.user, req.body)))
onboardingRouter.put('/company', validate({ body: schemas.companyBody }), answer((req) => companies.saveOnboardingCompany(req.user, req.body)))
onboardingRouter.post(
  '/documents',
  upload('kyc'),
  validate({ body: schemas.documentBody }),
  answer((req) => companies.uploadDocument(req.user, req.body.type, req.file), 201),
)
onboardingRouter.delete('/documents/:id', validate({ params: schemas.idParams }), answer((req) => companies.deleteDocument(req.user, req.params.id)))

// M-003: the code is shown on screen; the same rules as the candidate phone check (M-004).
onboardingRouter.post('/phone/code', validate({ body: phoneCodeBody }), async (req, res) => {
  companies.assertEditable(req.user)
  res.json(await requestPhoneCode(req.user, req.body))
})
onboardingRouter.post(
  '/phone/confirm',
  validate({ body: phoneConfirmBody }),
  answer(async (req) => {
    companies.assertEditable(req.user)
    await confirmPhone(req.user, req.body.code)
  }),
)
onboardingRouter.post('/submit', answer((req) => companies.submit(req.user)))

/** The Company page (M-147, M-150). */
export const companyRouter = Router()
companyRouter.use(requireAuth, requireApprovedRecruiter)

const companyAnswer = (work) => async (req, res) => {
  await work(req)
  res.json(await companies.companyDto(req.company, req.user._id))
}

companyRouter.get('/', companyAnswer(() => {}))
companyRouter.patch('/', validate({ body: schemas.companyPatchBody }), companyAnswer((req) => companies.updateCompany(req.user, req.company, req.body)))
companyRouter.post('/logo', upload('company_logo'), companyAnswer((req) => companies.setLogo(req.user, req.company, req.file)))
companyRouter.delete('/logo', companyAnswer((req) => companies.removeLogo(req.company)))

/** Moderation › Account review (M-165, P4-Q2). */
export const adminRouter = Router()
adminRouter.use(requireAuth, requireRole('admin'), requirePermission('moderation.manage'))

adminRouter.get('/', validate({ query: schemas.accountsQuery }), async (req, res) => {
  res.json({ ...(await review.listAccounts(req.query.status)), counts: await review.accountCounts() })
})

adminRouter.get('/:userId', validate({ params: schemas.accountParams }), async (req, res) => {
  res.json(await review.accountDetail(req.user, req.params.userId))
})

adminRouter.post('/:userId/decision', validate({ params: schemas.accountParams, body: schemas.accountDecisionBody }), async (req, res) => {
  await review.decideAccount(req.user, req.params.userId, req.body)
  res.json(await review.accountDetail(req.user, req.params.userId))
})
