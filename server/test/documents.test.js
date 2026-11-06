import assert from 'node:assert/strict'
import { access } from 'node:fs/promises'
import { before, describe, it } from 'node:test'
import { absolutePath } from '../lib/files.js'
import { EmailLog } from '../lib/mail/emailLog.model.js'
import { Application, PipelineStage } from '../modules/applications/applications.model.js'
import { CandidateProfile } from '../modules/candidates/candidates.model.js'
import { Company } from '../modules/companies/companies.model.js'
import { CvVersion } from '../modules/cv/cv.model.js'
import { RecruiterActivity } from '../modules/discovery/discovery.model.js'
import { File, FileAccessLog } from '../modules/files/files.model.js'
import { DocumentRequest } from '../modules/interviews/interviews.model.js'
import { Job } from '../modules/jobs/jobs.model.js'
import { Conversation, Message } from '../modules/messages/messages.model.js'
import { Notification } from '../modules/notifications/notifications.model.js'
import { Subscription } from '../modules/payments/payments.model.js'
import { User } from '../modules/users/users.model.js'
import { VerificationSubmission } from '../modules/verification/verification.model.js'
import { seedCatalog } from '../seed/catalog.js'
import { PLACES } from '../seed/data/places.js'
import { docx, image, MB, padded, textPdf } from './helpers/fixtures.js'
import { api, attach, auth, createUser, mailTo, useTestDb, useTestUploads } from './helpers/index.js'
import { applicantCandidate, approvedRecruiter } from './helpers/market.js'

/* Phase 11d document requests (§3.23, P11d-Q7, Q19 … Q22, Q27). */
useTestDb([User, Company, Job, CandidateProfile, CvVersion, File, FileAccessLog, VerificationSubmission, Subscription, PipelineStage, Application, Conversation, Message, EmailLog, RecruiterActivity, DocumentRequest])
useTestUploads()
before(() => seedCatalog())

const v1 = '/api/v1'
const code = (res) => res.body.error?.code

async function market({ plus = true } = {}) {
  const { user: recruiter, company } = await approvedRecruiter({ plus })
  const candidate = await applicantCandidate({ language: 'fr' })
  const job = await Job.create({
    companyId: company._id,
    createdBy: recruiter._id,
    title: 'Senior Product Designer',
    employmentType: 'full_time',
    brief: 'Lead the design of our hiring tools, from research to shipped product, with a small and kind team.',
    requiredSkills: [{ name: 'Figma', key: 'figma' }],
    level: 'senior',
    experienceYears: 5,
    workPreference: 'hybrid',
    country: 'GB',
    location: PLACES.london,
    status: 'published',
    publishedAt: new Date(),
  })
  const stage = await PipelineStage.findOne({ companyId: company._id, isEntry: true })
  const application = await Application.create({ candidateId: candidate._id, jobId: job._id, companyId: company._id, stageId: stage._id, consentAt: new Date(), appliedAt: new Date(), history: [{ status: 'applied', at: new Date(), actorType: 'candidate' }] })
  return { recruiter, company, candidate, application }
}

const request = (recruiter, fields, file) => {
  const req = api().post(`${v1}/document-requests`).set(auth(recruiter))
  if (file) return attach(req, file.buffer, file.name, file.type, fields)
  for (const [name, value] of Object.entries(fields)) req.field(name, value)
  return req
}
const upload = (candidate, id, itemId, buffer, name, type) => attach(api().post(`${v1}/document-requests/${id}/items/${itemId}`).set(auth(candidate)), buffer, name, type)

describe('Document requests (P11d-Q7, Q19 … Q21)', () => {
  it('a card in the thread; the candidate is told; uploads, replacements and declines; the recruiter hears; complete closes it', async () => {
    const { recruiter, candidate, application } = await market()
    const items = JSON.stringify([{ kind: 'id' }, { kind: 'signed_offer' }, { kind: 'other', label: 'Portfolio PDF' }])
    const missingLabel = await request(recruiter, { applicationId: String(application._id), items: JSON.stringify([{ kind: 'other' }]) })
    assert.deepEqual(missingLabel.body.error.fields, { 'items.0.label': 'required' })

    const offerLetter = await textPdf(['Offer letter'])
    const created = await request(recruiter, { applicationId: String(application._id), items, note: 'Please sign the offer.' }, { buffer: offerLetter, name: 'offer.pdf', type: 'application/pdf' })
    assert.equal(created.status, 201)
    assert.equal(created.body.items.length, 3)
    assert.equal(created.body.attachment.name, 'offer.pdf')
    const [mail] = mailTo(candidate.email, 'document_request')
    assert.equal(mail.language, 'fr')
    assert.deepEqual(mail.params.items, ['Pièce d’identité', 'Offre signée', 'Portfolio PDF'])
    assert.ok(await Notification.exists({ userId: candidate._id, type: 'document_requested', 'target.kind': 'document_request' }))
    const thread = (await api().get(`${v1}/conversations/${created.body.conversationId}/messages`).set(auth(candidate))).body
    assert.deepEqual(thread.items.map((message) => [message.kind, message.event]), [['document_request', 'created']])
    assert.equal(thread.cards.documentRequests[0].id, created.body.id)
    assert.ok(await RecruiterActivity.exists({ type: 'document_request' }))

    const [id, offer, other] = created.body.items.map((item) => item.id)
    const card = created.body.id
    // P11d-Q7: PDF, JPG or PNG up to 10 MB.
    assert.equal(code(await upload(candidate, card, id, await docx('My ID'), 'id.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')), 'FILE_TYPE_NOT_ALLOWED')
    assert.equal(code(await upload(candidate, card, id, padded(await textPdf(['big']), 11 * MB), 'big.pdf', 'application/pdf')), 'FILE_TOO_LARGE')
    assert.equal((await upload(candidate, card, id, await textPdf(['ID']), 'id.pdf', 'application/pdf')).status, 200)
    const answered = await Notification.findOne({ userId: recruiter._id, type: 'document_answered' })
    assert.equal(answered.params.candidate, candidate.fullName)

    // Replacing removes the earlier file from disk.
    const firstFile = await File.findById((await DocumentRequest.findById(card)).items.id(id).fileId)
    const replaced = await upload(candidate, card, id, await image('png'), 'id.png', 'image/png')
    assert.equal(replaced.body.items[0].file.name, 'id.png')
    await assert.rejects(access(absolutePath(firstFile)))
    assert.equal(mailTo(recruiter.email, 'documents_received').length, 0)

    await upload(candidate, card, offer, await textPdf(['Signed']), 'signed.pdf', 'application/pdf').expect(200)
    const declined = await api().post(`${v1}/document-requests/${card}/items/${other}/decline`).set(auth(candidate)).send({ note: 'I do not have one.' })
    assert.equal(declined.body.items[2].declineNote, 'I do not have one.')
    assert.equal(mailTo(recruiter.email, 'documents_received').length, 1)
    assert.ok(await Notification.exists({ userId: recruiter._id, type: 'documents_received' }))
    assert.equal(await Notification.countDocuments({ userId: recruiter._id, type: 'document_answered', readAt: null }), 1, 'one unread per request')

    await api().post(`${v1}/document-requests/${card}/complete`).set(auth(recruiter)).expect(200)
    assert.equal(code(await upload(candidate, card, id, await image('png'), 'late.png', 'image/png')), 'CONFLICT')
  })

  it('only the company and the candidate open the files; every opening is logged; others and admins are refused', async () => {
    const { recruiter, candidate, application } = await market()
    const { body } = await request(recruiter, { applicationId: String(application._id), items: JSON.stringify([{ kind: 'id' }]) })
    const uploaded = (await upload(candidate, body.id, body.items[0].id, await textPdf(['ID']), 'id.pdf', 'application/pdf')).body
    const recruiterView = (await api().get(`${v1}/document-requests/${body.id}`).set(auth(recruiter))).body
    await api().get(recruiterView.items[0].file.url).expect(200)
    await api().get(recruiterView.items[0].file.url).expect(200)
    await api().get(uploaded.items[0].file.url).expect(200)
    const fileId = recruiterView.items[0].file.url.split('/files/')[1].split('?')[0]
    assert.equal(await FileAccessLog.countDocuments({ fileId }), 3)
    assert.equal(await FileAccessLog.countDocuments({ fileId, accessorId: recruiter._id }), 2)

    const other = await approvedRecruiter()
    const stranger = await applicantCandidate()
    const admin = await createUser({ role: 'admin', isOwner: true })
    assert.equal((await api().get(`${v1}/document-requests/${body.id}`).set(auth(other.user))).status, 404)
    assert.equal((await api().get(`${v1}/document-requests/${body.id}`).set(auth(stranger))).status, 404)
    assert.equal((await api().get(`${v1}/document-requests/${body.id}`).set(auth(admin))).status, 403)
    assert.equal((await request(other.user, { applicationId: String(application._id), items: JSON.stringify([{ kind: 'id' }]) })).body.error.fields.applicationId, 'invalid')
    // A URL signed for the recruiter does not open for someone else's id.
    const forged = recruiterView.items[0].file.url.replace(String(recruiter._id), String(other.user._id))
    assert.equal((await api().get(forged)).status, 403)
  })

  it('Recruiter Plus to ask; after the plan ends the candidate still answers and the recruiter completes (P11d-Q22, Q27)', async () => {
    const { recruiter, candidate, application } = await market()
    const { body } = await request(recruiter, { applicationId: String(application._id), items: JSON.stringify([{ kind: 'references' }]) })
    await Subscription.deleteMany({ userId: { $in: [recruiter._id, candidate._id] } })
    assert.equal((await request(recruiter, { applicationId: String(application._id), items: JSON.stringify([{ kind: 'id' }]) })).status, 402)
    await upload(candidate, body.id, body.items[0].id, await image('jpg'), 'refs.jpg', 'image/jpeg').expect(200)
    await api().post(`${v1}/document-requests/${body.id}/complete`).set(auth(recruiter)).expect(200)
  })
})
