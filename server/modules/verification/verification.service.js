import { config } from '../../config/env.js'
import { LIMITS } from '../../config/limits.js'
import { actorFor, recordAudit } from '../../lib/audit.js'
import { AppError, fieldError } from '../../lib/errors.js'
import { signedUrl, storeFile } from '../../lib/files.js'
import { t } from '../../lib/i18n.js'
import { sanitizedUpload } from '../../lib/images.js'
import { sendEmail } from '../../lib/mailer.js'
import { assertCodeResendAllowed, issueCode, normalizePhone, verifyCode } from '../auth/auth.service.js'
import { loadProfile, refreshCompleteness } from '../candidates/candidates.service.js'
import { File } from '../files/files.model.js'
import { User } from '../users/users.model.js'
import { VerificationSubmission } from './verification.model.js'

/*
 * Phone codes (M-003, M-004, OD3), evidence submissions (M-166) and the admin verification queue.
 * Self-approval is gone: only an admin decision approves evidence (M-016).
 */
const EVIDENCE_RETENTION_MS = 30 * 24 * 60 * 60 * 1000 // M-186, U32

// §3.2: evidence types per check; right to work and certificates have none.
const EVIDENCE_TYPES = {
  identity: ['passport', 'driving_licence', 'national_id'],
  academic: ['degree_certificate', 'diploma', 'transcript'],
  employment: ['employment_letter', 'contract_page', 'verified_reference'],
}
// The profile list each category's entry lives in; identity links the account name instead.
const ENTRY_LISTS = { academic: 'education', employment: 'workHistory', right_to_work: 'rightToWork', certificate: 'certificates' }
const CHECKS = Object.keys(EVIDENCE_TYPES)

/* ---------- phone ---------- */

/** M-003: the code is returned for the screen (no SMS). A changed number is unverified until confirmed (M-004). */
export async function requestPhoneCode(user, { phone, country }) {
  const e164 = normalizePhone(phone, country)
  await assertCodeResendAllowed(user._id, 'phone')
  if (user.phone?.e164 !== e164) {
    user.phone = { e164 }
    await user.save()
    await refreshCompleteness(user._id)
  }
  const code = await issueCode(user._id, 'phone', e164)
  return { phone: e164, code, expiresInSeconds: LIMITS.code.ttlMs / 1000 }
}

export async function confirmPhone(user, code) {
  if (!user.phone?.e164) throw new AppError('CODE_EXPIRED')
  await verifyCode(user._id, 'phone', code)
  user.phone.verifiedAt = new Date()
  await user.save()
  await refreshCompleteness(user._id)
}

/* ---------- candidate side ---------- */

const latestFor = (userId, category, entryId) =>
  VerificationSubmission.findOne({ userId, category, entryId: entryId ?? null }).sort({ submittedAt: -1 })

/** M-166: evidence linked to its profile entry; P3-D8: a new one only after a rejection or a reset. */
export async function submitEvidence(user, { category, evidenceType, entryId }, upload) {
  const profile = await loadProfile(user._id)
  const types = EVIDENCE_TYPES[category]
  if (types && !evidenceType) throw fieldError({ evidenceType: 'required' })
  if (types && !types.includes(evidenceType)) throw fieldError({ evidenceType: 'invalid' })
  if (!types && evidenceType) throw fieldError({ evidenceType: 'not_allowed' })

  const list = ENTRY_LISTS[category]
  if (!list && entryId) throw fieldError({ entryId: 'not_allowed' })
  const entry = list && entryId ? profile[list].id(entryId) : null
  if (list && !entry) throw fieldError({ entryId: entryId ? 'invalid' : 'required' })

  const last = await latestFor(user._id, category, entry?._id)
  if (last && !last.resetAt && last.status !== 'rejected') throw new AppError('CONFLICT')

  let fileId
  if (category === 'certificate') {
    // M-025: a certificate is verified from its own file, which retention keeps (C18).
    if (upload) throw fieldError({ file: 'not_allowed' })
    if (!entry.fileId) throw fieldError({ entryId: 'no_file' })
    fileId = entry.fileId
  } else {
    if (!upload) throw fieldError({ file: 'required' })
    const buffer = await sanitizedUpload(upload)
    fileId = (await storeFile({ ownerId: user._id, purpose: 'evidence', buffer, ext: upload.ext, originalName: upload.originalname }))._id
  }
  await VerificationSubmission.create({ userId: user._id, category, evidenceType, entryId: entry?._id, fileId, previousSubmissionId: last?._id })
}

/** A check's state: approved (counted), in review, rejected (latest) or not started. */
function stateOf(submissions) {
  if (submissions.some((submission) => submission.status === 'approved')) return 'approved'
  if (submissions.some((submission) => submission.status === 'in_review')) return 'in_review'
  return submissions[0]?.status === 'rejected' ? 'rejected' : 'not_started'
}

const submissionDto = (submission, files) =>
  submission && {
    id: String(submission._id),
    category: submission.category,
    evidenceType: submission.evidenceType ?? null,
    entryId: submission.entryId ? String(submission.entryId) : null,
    status: submission.status,
    submittedAt: submission.submittedAt,
    reviewedAt: submission.reviewedAt ?? null,
    reason: submission.reason ?? null,
    fileName: files.get(String(submission.fileId))?.originalName ?? null,
  }

/** GET /candidate/verification: contact checks, the three named checks and the per-entry requests. */
export async function verificationState(user) {
  const profile = await loadProfile(user._id)
  const submissions = await VerificationSubmission.find({ userId: user._id, resetAt: null }).sort({ submittedAt: -1 })
  const fileIds = submissions.map((submission) => submission.fileId)
  const files = new Map((await File.find({ _id: { $in: fileIds } }, 'originalName')).map((file) => [String(file._id), file]))
  const of = (category, entryId) =>
    submissions.filter((submission) => submission.category === category && (entryId === undefined || String(submission.entryId) === String(entryId)))
  const summary = (list) => ({ status: stateOf(list), latest: submissionDto(list[0], files) })

  // M-023: identity always; academic and employment when such an entry exists.
  const required = new Set(['identity'])
  if (profile.education.length) required.add('academic')
  if (profile.workHistory.length) required.add('employment')
  const checks = CHECKS.map((category) => ({ category, required: required.has(category), evidenceTypes: EVIDENCE_TYPES[category], ...summary(of(category)) }))
  const approvedRequired = checks.filter((check) => check.required && check.status === 'approved').length

  return {
    email: { address: user.email, verified: Boolean(user.emailVerifiedAt) },
    phone: { e164: user.phone?.e164 ?? null, verified: Boolean(user.phone?.verifiedAt) },
    checks,
    // OQ-6f: "Verified" = every required check approved.
    verified: approvedRequired === required.size,
    verifiedCount: approvedRequired,
    requiredCount: required.size,
    entries: {
      academic: profile.education.map(({ _id, degree, institution }) => ({ id: String(_id), degree, institution })),
      employment: profile.workHistory.map(({ _id, title, employer }) => ({ id: String(_id), title, employer })),
    },
    rightToWork: profile.rightToWork.map((entry) => ({
      id: String(entry._id),
      region: entry.region,
      status: entry.status,
      permitExpiresOn: entry.permitExpiresOn ?? null,
      ...summary(of('right_to_work', entry._id)),
    })),
    certificates: profile.certificates.map((entry) => ({
      id: String(entry._id),
      name: entry.name,
      issuer: entry.issuer,
      hasFile: Boolean(entry.fileId),
      ...summary(of('certificate', entry._id)),
    })),
  }
}

/* ---------- admin queue (Moderation › Candidate verification) ---------- */

const queueRow = (submission, user) => ({
  id: String(submission._id),
  candidate: user ? { id: String(user._id), fullName: user.fullName, email: user.email } : null,
  category: submission.category,
  evidenceType: submission.evidenceType ?? null,
  status: submission.status,
  submittedAt: submission.submittedAt,
  reviewedAt: submission.reviewedAt ?? null,
})

/** P3-D8: oldest first. Evidence withdrawn by an entry change (U27) leaves the "In review" queue. */
export async function listQueue(status) {
  const submissions = await VerificationSubmission.find({ status, ...(status === 'in_review' && { resetAt: null }) }).sort({ submittedAt: 1 })
  const userIds = submissions.map((submission) => submission.userId)
  const users = new Map((await User.find({ _id: { $in: userIds } }, 'fullName email')).map((user) => [String(user._id), user]))
  const items = submissions.map((submission) => queueRow(submission, users.get(String(submission.userId))))
  return { items, total: items.length, page: 1, pageSize: items.length }
}

/** The profile claim the evidence must match (A: admin §9.2): the name, or the linked entry as it is now. */
function claimOf(submission, user, profile) {
  if (submission.category === 'identity') return { fullName: user.fullName }
  const entry = profile[ENTRY_LISTS[submission.category]].id(submission.entryId)
  if (!entry) return null
  const fields = entry.toObject()
  delete fields._id
  delete fields.fileId
  return fields
}

export async function submissionDetail(admin, id) {
  const submission = await VerificationSubmission.findById(id)
  if (!submission) throw new AppError('NOT_FOUND')
  const [user, profile, file, reviewer, history] = await Promise.all([
    User.findById(submission.userId, 'fullName email'),
    loadProfile(submission.userId),
    File.findById(submission.fileId, 'originalName mime'),
    submission.reviewedBy ? User.findById(submission.reviewedBy, 'fullName') : null,
    VerificationSubmission.find({ userId: submission.userId, category: submission.category, entryId: submission.entryId ?? null, _id: { $ne: submission._id } }).sort({ submittedAt: -1 }),
  ])
  const photo = profile.photo?.smallFileId ? await File.findById(profile.photo.smallFileId) : null
  return {
    ...queueRow(submission, user),
    candidate: { id: String(user._id), fullName: user.fullName, email: user.email, photoUrl: photo ? signedUrl(photo, admin._id) : null },
    reason: submission.reason ?? null,
    reset: Boolean(submission.resetAt),
    reviewedBy: reviewer?.fullName ?? null,
    file: file ? { id: String(file._id), name: file.originalName, mime: file.mime } : null,
    claim: claimOf(submission, user, profile),
    history: history.map((previous) => ({
      id: String(previous._id),
      evidenceType: previous.evidenceType ?? null,
      status: previous.status,
      submittedAt: previous.submittedAt,
      reviewedAt: previous.reviewedAt ?? null,
      reason: previous.reason ?? null,
    })),
  }
}

/** M-166: Approve, or Reject with a reason; emailed in the candidate's language (M-092) and audited (M-162). */
export async function decide(admin, id, { decision, reason }) {
  if (decision === 'rejected' && !reason) throw fieldError({ reason: 'required' })
  const now = new Date()
  const submission = await VerificationSubmission.findOneAndUpdate(
    { _id: id, status: 'in_review', resetAt: null },
    { status: decision, reason: decision === 'rejected' ? reason : undefined, reviewedBy: admin._id, reviewedAt: now },
    { returnDocument: 'after' },
  )
  if (!submission) throw new AppError((await VerificationSubmission.exists({ _id: id })) ? 'CONFLICT' : 'NOT_FOUND')
  // M-186: evidence files go 30 days after the decision; certificate files stay (C18).
  if (submission.category !== 'certificate') await File.updateOne({ _id: submission.fileId }, { deleteAfter: new Date(now.getTime() + EVIDENCE_RETENTION_MS) })
  await refreshCompleteness(submission.userId)

  const user = await User.findById(submission.userId)
  await sendEmail({
    type: `verification_${decision}`,
    to: user.email,
    userId: user._id,
    language: user.language,
    params: {
      name: user.fullName,
      check: t(user.language, `verification.category.${submission.category}`),
      reason: reason ?? '',
      link: `${config.clientOrigin}/candidate/verification`,
    },
  })
  await recordAudit({
    type: `moderation.verification_${decision}`,
    category: 'moderation',
    actor: actorFor(admin),
    target: { type: 'verification_submission', id: submission._id },
    params: { candidate: user.fullName, category: submission.category, evidenceType: submission.evidenceType, reason },
  })
}
