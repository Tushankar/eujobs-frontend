import { Router } from 'express'
import { z } from 'zod'
import { objectId, validate } from '../../lib/validate.js'
import { requireApprovedRecruiter, requireAuth } from '../../middleware/auth.js'
import * as schemas from './discovery.schemas.js'
import * as discovery from './discovery.service.js'

/* /recruiter/candidates, /recruiter/shortlist and /recruiter/overview (§5): approved recruiters only (M-151). */
const candidateParams = validate({ params: schemas.candidateParams })

export const candidatesRouter = Router()
candidatesRouter.use(requireAuth, requireApprovedRecruiter)

candidatesRouter.get('/', validate({ query: schemas.discoveryQuery }), async (req, res) => {
  res.json(await discovery.listCandidates(req.user, req.company, req.query))
})

candidatesRouter.get('/:id', candidateParams, validate({ query: z.object({ jobId: objectId.optional() }) }), async (req, res) => {
  res.json(await discovery.candidateProfile(req.user, req.company, req.params.id, req.query.jobId))
})

candidatesRouter.get('/:id/cv', candidateParams, async (req, res) => {
  res.json(await discovery.candidateCv(req.user, req.company, req.params.id))
})

candidatesRouter.post('/:id/cv-requests', candidateParams, validate({ body: schemas.cvRequestBody }), async (req, res) => {
  await discovery.requestCv(req.user, req.company, req.params.id, req.body)
  res.status(201).json(await discovery.candidateCv(req.user, req.company, req.params.id))
})

candidatesRouter.get('/:id/activity', candidateParams, async (req, res) => {
  res.json(await discovery.activity(req.company, req.params.id))
})

candidatesRouter.get('/:id/note', candidateParams, async (req, res) => {
  res.json(await discovery.getNote(req.company, req.params.id))
})

candidatesRouter.put('/:id/note', candidateParams, validate({ body: schemas.noteBody }), async (req, res) => {
  res.json(await discovery.saveNote(req.user, req.company, req.params.id, req.body.text))
})

export const shortlistRouter = Router()
shortlistRouter.use(requireAuth, requireApprovedRecruiter)
const shortlistParams = validate({ params: z.object({ candidateId: objectId }) })

shortlistRouter.get('/', validate({ query: schemas.discoveryQuery }), async (req, res) => {
  res.json(await discovery.shortlist(req.user, req.company, req.query))
})

shortlistRouter.put('/:candidateId', shortlistParams, async (req, res) => {
  await discovery.addToShortlist(req.user, req.company, req.params.candidateId)
  res.json({ shortlisted: true })
})

shortlistRouter.delete('/:candidateId', shortlistParams, async (req, res) => {
  await discovery.removeFromShortlist(req.user, req.company, req.params.candidateId)
  res.json({ shortlisted: false })
})

export const overviewRouter = Router()
overviewRouter.use(requireAuth, requireApprovedRecruiter)

overviewRouter.get('/', async (req, res) => {
  res.json(await discovery.recruiterOverview(req.company))
})

overviewRouter.get('/talent', async (req, res) => {
  res.json(await discovery.talentCards(req.user, req.company))
})
