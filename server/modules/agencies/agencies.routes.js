import { Router } from 'express'
import { validate } from '../../lib/validate.js'
import { requireApprovedAgency, requireAuth, requireRole } from '../../middleware/auth.js'
import { requireEntitlement } from '../../middleware/entitlements.js'
import { upload } from '../../middleware/upload.js'
import * as schemas from './agencies.schemas.js'
import * as agencies from './agencies.service.js'
import * as agreements from './agreements.service.js'
import * as books from './books.service.js'
import * as placements from './placements.service.js'
import * as ranking from './ranking.service.js'
import { rulesBody } from './contracts.js'

/* /agency/clients (2026-11-20): an approved agency's clients. Updates replace the whole client (PUT). */
export const clientsRouter = Router()
clientsRouter.use(requireAuth, requireApprovedAgency)

const params = validate({ params: schemas.clientParams })
const answer = (work, status = 200) => async (req, res) => {
  res.status(status).json(await agencies.clientDto(await work(req), req.user._id))
}

clientsRouter.get('/', async (req, res) => {
  res.json(await agencies.listClients(req.user, req.company))
})

// Before /:id, so "companies" is not read as a client id.
clientsRouter.get('/companies', validate({ query: schemas.companySearchQuery }), async (req, res) => {
  res.json(await agencies.searchCompanies(req.user, req.query.q))
})

clientsRouter.post('/', validate({ body: schemas.clientBody }), answer((req) => agencies.createClient(req.user, req.company, req.body), 201))
clientsRouter.get('/:id', params, answer((req) => agencies.ownClient(req.company, req.params.id)))
clientsRouter.put('/:id', params, validate({ body: schemas.clientBody }), answer((req) => agencies.updateClient(req.user, req.company, req.params.id, req.body)))
clientsRouter.delete('/:id', params, async (req, res) => {
  await agencies.deleteClient(req.company, req.params.id)
  res.status(204).end()
})
clientsRouter.post('/:id/logo', params, upload('client_logo'), answer((req) => agencies.setClientLogo(req.user, req.company, req.params.id, req.file)))
clientsRouter.delete('/:id/logo', params, answer((req) => agencies.removeClientLogo(req.company, req.params.id)))

/* /agency/agreement (2026-11-20): the agreement's versions; one draft at a time, published to become current. */
export const agreementRouter = Router()
agreementRouter.use(requireAuth, requireApprovedAgency)

const overview = (work, status = 200) => async (req, res) => {
  await work(req)
  res.status(status).json(await agreements.agreementOverview(req.user, req.company))
}

agreementRouter.get('/', overview(() => {}))
agreementRouter.post('/', upload('agency_agreement'), overview((req) => agreements.uploadDraft(req.user, req.company, req.file), 201))
// Reading by AI is an Agency Plus feature; Free agencies type the rules.
agreementRouter.post('/draft/read', requireEntitlement('ai', ['agency']), overview((req) => agreements.readDraft(req.user, req.company)))
agreementRouter.put('/draft/rules', validate({ body: rulesBody }), overview((req) => agreements.saveDraftRules(req.company, req.body)))
agreementRouter.post('/draft/publish', overview((req) => agreements.publishDraft(req.user, req.company)))
agreementRouter.delete('/draft', overview((req) => agreements.deleteDraft(req.company)))

/* /agency/talent (2026-11-20): the candidates on the books, asking to join or invited. */
export const talentRouter = Router()
talentRouter.use(requireAuth, requireApprovedAgency)

const membershipParams = validate({ params: schemas.clientParams })
talentRouter.get('/', validate({ query: schemas.talentQuery }), async (req, res) => {
  res.json(await books.listTalent(req.company, req.query.status))
})
// Phase 6 (2026-11-23): the books ranked for one agency job; AI reasons are an Agency Plus feature. Before /:id routes.
talentRouter.get('/ranking', validate({ query: schemas.rankingQuery }), async (req, res) => {
  res.json(await ranking.rankTalent(req.company, req.query.jobId))
})
talentRouter.post('/ranking/reasons', requireEntitlement('ai', ['agency']), validate({ body: schemas.rankingBody }), async (req, res) => {
  res.json(await ranking.rankingReasons(req.user, req.company, req.body.jobId))
})
talentRouter.post('/invite', validate({ body: schemas.inviteBody }), async (req, res) => {
  res.status(201).json(await books.invite(req.user, req.company, req.body.candidateId))
})
talentRouter.post('/:id/accept', membershipParams, async (req, res) => {
  res.json(await books.accept(req.company, req.params.id))
})
talentRouter.post('/:id/decline', membershipParams, async (req, res) => {
  res.json(await books.declineByAgency(req.company, req.params.id))
})
talentRouter.post('/:id/end', membershipParams, async (req, res) => {
  res.json(await books.endByAgency(req.company, req.params.id))
})

/* /candidate/agencies (2026-11-20): the candidate's agencies. */
export const candidateRouter = Router()
candidateRouter.use(requireAuth, requireRole('candidate'))

candidateRouter.get('/', async (req, res) => {
  res.json(await books.myAgencies(req.user))
})
candidateRouter.post('/:companyId/join', validate({ params: schemas.companyParams }), async (req, res) => {
  res.status(201).json(await books.join(req.user, req.params.companyId))
})
candidateRouter.get('/memberships/:id/agreement', membershipParams, async (req, res) => {
  res.json(await books.agreementForCandidate(req.user, req.params.id))
})
candidateRouter.post('/memberships/:id/agree', membershipParams, validate({ body: schemas.agreeBody }), async (req, res) => {
  res.json(await books.agree(req.user, req.params.id, req.body.version))
})
candidateRouter.post('/memberships/:id/decline', membershipParams, async (req, res) => {
  res.json(await books.declineByCandidate(req.user, req.params.id))
})
candidateRouter.post('/memberships/:id/end', membershipParams, async (req, res) => {
  res.json(await books.endByCandidate(req.user, req.params.id))
})

/* /agency/placements (2026-11-20): the agency's offers and placements. */
export const agencyPlacementsRouter = Router()
agencyPlacementsRouter.use(requireAuth, requireApprovedAgency)

agencyPlacementsRouter.get('/', validate({ query: schemas.placementsQuery }), async (req, res) => {
  res.json(await placements.agencyPlacements(req.user, req.company, req.query.view))
})
// Phase 6: before /:id routes.
agencyPlacementsRouter.post('/offer', validate({ body: schemas.offerBody }), async (req, res) => {
  res.status(201).json(await placements.offerPlacement(req.user, req.company, req.body))
})
agencyPlacementsRouter.post('/:id/end', membershipParams, validate({ body: schemas.endBody }), async (req, res) => {
  res.json(await placements.endEarly(req.user, req.company, req.params.id, req.body.endDate))
})
agencyPlacementsRouter.post('/:id/rehire', membershipParams, validate({ body: schemas.rehireBody }), async (req, res) => {
  res.status(201).json(await placements.offerRehire(req.user, req.company, req.params.id, req.body.jobId))
})
agencyPlacementsRouter.post('/:id/withdraw', membershipParams, async (req, res) => {
  res.json(await placements.withdrawOffer(req.user, req.company, req.params.id))
})

/* /candidate/placements (2026-11-20): the candidate's offers and placements, and the rule check for a job. */
export const candidatePlacementsRouter = Router()
candidatePlacementsRouter.use(requireAuth, requireRole('candidate'))

candidatePlacementsRouter.get('/', validate({ query: schemas.placementsQuery }), async (req, res) => {
  res.json(await placements.myPlacements(req.user, req.query.view))
})
// Before /:id routes.
candidatePlacementsRouter.get('/check', validate({ query: schemas.checkQuery }), async (req, res) => {
  res.json(await placements.checkJob(req.user, req.query.jobId))
})
candidatePlacementsRouter.post('/:id/accept', membershipParams, async (req, res) => {
  res.json(await placements.acceptOffer(req.user, req.params.id))
})
candidatePlacementsRouter.post('/:id/decline', membershipParams, async (req, res) => {
  res.json(await placements.declineOffer(req.user, req.params.id))
})
candidatePlacementsRouter.post('/:id/notice', membershipParams, async (req, res) => {
  res.json(await placements.giveNotice(req.user, req.params.id))
})
