import { AppError, fieldError } from '../../lib/errors.js'
import { removeFiles, storeFile } from '../../lib/files.js'
import { t } from '../../lib/i18n.js'
import { ACTIVE_FILTER, Application } from '../applications/applications.model.js'
import { Company } from '../companies/companies.model.js'
import { recordActivity } from '../discovery/discovery.service.js'
import { Job } from '../jobs/jobs.model.js'
import { addEvent, threadFor } from '../messages/messages.service.js'
import { companyRecruiter, notify } from '../notifications/notifications.service.js'
import { User } from '../users/users.model.js'
import { documentRequestDtos } from './interviews.cards.js'
import { itemLink, sendInterviewEmail } from './interviews.emails.js'
import { DocumentRequest } from './interviews.model.js'

/*
 * Document requests (§3.23, P11d-Q7, Q19 … Q21): a card in the thread for one active application. The recruiter
 * (Recruiter Plus, checked by the route) names the documents and may attach a file; the candidate (never gated) uploads
 * one file per item, replaces it, or declines it with a note, until the recruiter marks the request complete.
 */
const ownFilter = (user) => (user.role === 'candidate' ? { candidateId: user._id } : { companyId: user.companyId })

async function ownRequest(user, id) {
  const request = await DocumentRequest.findOne({ _id: id, ...ownFilter(user) })
  if (!request) throw new AppError('NOT_FOUND')
  return request
}

const dto = async (user, request) => (await documentRequestDtos(user, [request]))[0]
const target = (request) => ({ kind: 'document_request', id: request._id })

async function namesOf(request) {
  const [candidate, recruiter, company, job] = await Promise.all([
    User.findById(request.candidateId),
    companyRecruiter(request.companyId),
    Company.findById(request.companyId, 'displayName'),
    Job.findById(request.jobId, 'title'),
  ])
  return { candidate, recruiter, company: company?.displayName ?? '', job: job?.title ?? '' }
}

/** The item names in the reader's language (an "other" item shows its own label). */
const itemNames = (request, language) => request.items.map((item) => (item.kind === 'other' ? item.label : t(language, `labels.documentKind.${item.kind}`)))

/** POST /document-requests (multipart: applicationId, items as JSON, note, optional file). */
export async function createRequest(user, company, { applicationId, items, note }, file) {
  const application = await Application.findOne({ _id: applicationId, companyId: company._id, ...ACTIVE_FILTER })
  if (!application) throw fieldError({ applicationId: 'invalid' })
  items.forEach((item, index) => {
    if (item.kind === 'other' && !item.label) throw fieldError({ [`items.${index}.label`]: 'required' })
  })
  const { conversation } = await threadFor({ companyId: company._id, candidateId: application.candidateId, jobId: application.jobId, startedBy: 'recruiter' })
  if (conversation.closedAt) throw new AppError('CONFLICT', { params: { reason: 'conversation_closed' } })
  const attachment = file && (await storeFile({ ownerId: user._id, purpose: 'document_attachment', buffer: file.buffer, ext: file.ext, originalName: file.originalname }))
  const request = await DocumentRequest.create({
    companyId: company._id,
    candidateId: application.candidateId,
    applicationId: application._id,
    jobId: application.jobId,
    conversationId: conversation._id,
    requestedBy: user._id,
    items: items.map(({ kind, label }) => ({ kind, label: kind === 'other' ? label : undefined })),
    note: note || undefined,
    attachmentFileId: attachment?._id,
  })
  await addEvent(conversation, user, { kind: 'document_request', event: 'created', documentRequestId: request._id })
  const { candidate, company: companyName, job } = await namesOf(request)
  await recordActivity({ companyId: company._id, candidateId: application.candidateId, actorId: user._id, type: 'document_request', params: { jobId: String(application.jobId), jobTitle: job, count: items.length } })
  if (candidate) {
    await notify(candidate, 'document_requested', { params: { company: companyName, job }, target: target(request) })
    await sendInterviewEmail('document_request', candidate, {
      company: companyName,
      job,
      items: itemNames(request, candidate.language ?? 'en'),
      note: note ?? '',
      link: itemLink('candidate', 'document-requests', request._id),
    })
  }
  return dto(user, request)
}

function openItem(request, itemId) {
  if (request.status !== 'open') throw new AppError('CONFLICT', { params: { reason: request.status } })
  const item = request.items.id(itemId)
  if (!item) throw new AppError('NOT_FOUND')
  return item
}

/**
 * The recruiter hears about each answer (one notification per request while unread); the first time every item is
 * answered, also the "documents received" bell and email (P11d-Q21).
 */
async function answered(request) {
  const { candidate, recruiter, job } = await namesOf(request)
  if (!recruiter) return
  const params = { candidate: candidate?.fullName ?? '', job }
  await notify(recruiter, 'document_answered', { params, target: target(request), groupKey: `document_request:${request._id}` })
  if (request.answeredAt || !request.items.every((item) => item.fileId || item.declinedAt)) return
  request.answeredAt = new Date()
  await request.save()
  await recordActivity({ companyId: request.companyId, candidateId: request.candidateId, type: 'documents_received', params: { jobId: String(request.jobId), jobTitle: job } })
  await notify(recruiter, 'documents_received', { params, target: target(request) })
  await sendInterviewEmail('documents_received', recruiter, { job, candidateName: candidate?.fullName, link: itemLink('recruiter', 'document-requests', request._id) })
}

/** POST /document-requests/:id/items/:itemId (candidate, multipart file): uploads or replaces the item's file. */
export async function uploadItem(user, id, itemId, file) {
  const request = await ownRequest(user, id)
  const item = openItem(request, itemId)
  const stored = await storeFile({ ownerId: user._id, purpose: 'document_request', buffer: file.buffer, ext: file.ext, originalName: file.originalname })
  const previous = item.fileId
  Object.assign(item, { fileId: stored._id, uploadedAt: new Date(), declineNote: undefined, declinedAt: undefined })
  await request.save()
  if (previous) await removeFiles([previous])
  await answered(request)
  return dto(user, request)
}

/** POST /document-requests/:id/items/:itemId/decline (candidate): declines the item with a note; a file is removed. */
export async function declineItem(user, id, itemId, { note }) {
  const request = await ownRequest(user, id)
  const item = openItem(request, itemId)
  const previous = item.fileId
  Object.assign(item, { fileId: undefined, uploadedAt: undefined, declineNote: note, declinedAt: new Date() })
  await request.save()
  if (previous) await removeFiles([previous])
  await answered(request)
  return dto(user, request)
}

/** POST /document-requests/:id/complete (recruiter; allowed on Free, P11d-Q27): no more changes. */
export async function completeRequest(user, id) {
  const request = await ownRequest(user, id)
  if (request.status !== 'open') throw new AppError('CONFLICT', { params: { reason: request.status } })
  request.status = 'complete'
  request.completedAt = new Date()
  await request.save()
  return dto(user, request)
}

export async function getRequest(user, id) {
  return dto(user, await ownRequest(user, id))
}
