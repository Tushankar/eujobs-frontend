import { Router } from 'express'
import { z } from 'zod'
import { objectId, validate } from '../../lib/validate.js'
import { requireApprovedRecruiter, requireAuth } from '../../middleware/auth.js'
import { hasEntitlement, planRequired, requireEntitlement } from '../../middleware/entitlements.js'
import { Application } from '../applications/applications.model.js'
import { planState } from '../payments/payments.service.js'
import * as schemas from './discovery.schemas.js'
import * as discoveryService from './discovery.service.js'

/*
 * /recruiter/candidates, /recruiter/shortlist and /recruiter/overview (§5): approved recruiters only (M-151). Without
 * Recruiter Plus (§3.22, P11c-Q10, Q15) a recruiter reaches only the company's applicants; search, the shortlist,
 * the talent lists and CV requests answer 402 PLAN_REQUIRED.
 */
const candidateParams = validate({ params: schemas.candidateParams })
export const requireDiscovery = requireEntitlement('discovery', ['recruiter'])

/** A candidate who applied to the company opens on Free; anyone else needs `discovery`. */
async function applicantOrDiscovery(req, res, next) {
  if (!(await Application.exists({ companyId: req.company._id, candidateId: req.params.id })) && !(await hasEntitlement(req.user, 'discovery'))) {
    throw planRequired('discovery')
  }
  next()
}
const candidate = [candidateParams, applicantOrDiscovery]

export const candidatesRouter = Router()
candidatesRouter.use(requireAuth, requireApprovedRecruiter)

candidatesRouter.get('/', validate({ query: schemas.discoveryQuery }), async (req, res) => {
  res.json(await discoveryService.listCandidates(req.user, req.company, req.query, (await planState(req.user._id)).entitlements))
})

candidatesRouter.get('/:id', ...candidate, validate({ query: z.object({ jobId: objectId.optional() }) }), async (req, res) => {
  res.json(await discoveryService.candidateProfile(req.user, req.company, req.params.id, req.query.jobId))
})

candidatesRouter.get('/:id/cv', ...candidate, async (req, res) => {
  res.json(await discoveryService.candidateCv(req.user, req.company, req.params.id))
})

candidatesRouter.post('/:id/cv-requests', candidateParams, requireEntitlement('outreach', ['recruiter']), validate({ body: schemas.cvRequestBody }), async (req, res) => {
  await discoveryService.requestCv(req.user, req.company, req.params.id, req.body)
  res.status(201).json(await discoveryService.candidateCv(req.user, req.company, req.params.id))
})

candidatesRouter.get('/:id/activity', ...candidate, async (req, res) => {
  res.json(await discoveryService.activity(req.company, req.params.id))
})

candidatesRouter.get('/:id/note', ...candidate, async (req, res) => {
  res.json(await discoveryService.getNote(req.company, req.params.id))
})

candidatesRouter.put('/:id/note', ...candidate, validate({ body: schemas.noteBody }), async (req, res) => {
  res.json(await discoveryService.saveNote(req.user, req.company, req.params.id, req.body.text))
})

export const shortlistRouter = Router()
shortlistRouter.use(requireAuth, requireApprovedRecruiter, requireDiscovery)
const shortlistParams = validate({ params: z.object({ candidateId: objectId }) })

shortlistRouter.get('/', validate({ query: schemas.discoveryQuery }), async (req, res) => {
  res.json(await discoveryService.shortlist(req.user, req.company, req.query))
})

shortlistRouter.put('/:candidateId', shortlistParams, async (req, res) => {
  await discoveryService.addToShortlist(req.user, req.company, req.params.candidateId)
  res.json({ shortlisted: true })
})

shortlistRouter.delete('/:candidateId', shortlistParams, async (req, res) => {
  await discoveryService.removeFromShortlist(req.user, req.company, req.params.candidateId)
  res.json({ shortlisted: false })
})

export const overviewRouter = Router()
overviewRouter.use(requireAuth, requireApprovedRecruiter)

overviewRouter.get('/', async (req, res) => {
  res.json(await discoveryService.recruiterOverview(req.company))
})

overviewRouter.get('/talent', requireDiscovery, async (req, res) => {
  res.json(await discoveryService.talentCards(req.user, req.company))
})
