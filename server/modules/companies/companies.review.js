import { config } from '../../config/env.js'
import { actorFor, recordAudit } from '../../lib/audit.js'
import { AppError, fieldError } from '../../lib/errors.js'
import { t } from '../../lib/i18n.js'
import { sendEmail } from '../../lib/mailer.js'
import { effectivePermissions } from '../admin/admin.service.js'
import { PipelineStage } from '../applications/applications.model.js'
import { File } from '../files/files.model.js'
import { User } from '../users/users.model.js'
import { Company, KycDocument } from './companies.model.js'
import { companyDto } from './companies.service.js'

/*
 * Moderation › Account review (§3.12, M-165, OQ-2, P4-Q2): recruiters by status, the review detail and the
 * decisions. Decision emails always go out (M-095); every decision is audited (M-162).
 */
const DAY_MS = 24 * 60 * 60 * 1000
const KYC_RETENTION_MS = 30 * DAY_MS // M-186, U32

// P4-Q2: the decisions each status allows.
const ACTIONS = {
  pending_review: ['approved', 'rejected', 'suspended'],
  active: ['suspended'],
  suspended: ['approved'],
  rejected: [],
}
const RESULT_STATUS = { approved: 'active', rejected: 'rejected', suspended: 'suspended' }

// OD5, §3.4: created in the company's language on first approval, then user content (M-142).
const DEFAULT_STAGES = [
  { key: 'applied', tone: 'neutral', isEntry: true },
  { key: 'screening', tone: 'primary' },
  { key: 'shortlisted', tone: 'primary' },
  { key: 'interview', tone: 'primary' },
  { key: 'offer', tone: 'success' },
  { key: 'hired', tone: 'success' },
]

/** Suspending, and approving a suspended recruiter, also need `users.deactivate` (§3.13, OQ-2). */
export async function allowedActions(admin, status) {
  const permissions = await effectivePermissions(admin)
  return ACTIONS[status].filter((decision) => !(decision === 'suspended' || status === 'suspended') || permissions.has('users.deactivate'))
}

const row = (user, company) => ({
  id: String(user._id),
  fullName: user.fullName,
  email: user.email,
  status: user.status,
  company: company ? { legalName: company.legalName, displayName: company.displayName, countryCode: company.location?.countryCode ?? null } : null,
  submittedAt: company?.submittedAt ?? null,
  createdAt: user.createdAt,
})

/** Pending review oldest first; the other statuses most recently changed first. */
export async function listAccounts(status) {
  const users = await User.find({ role: 'recruiter', status }).sort(status === 'pending_review' ? {} : { updatedAt: -1 })
  const companies = new Map((await Company.find({ ownerUserId: { $in: users.map((user) => user._id) } })).map((company) => [String(company.ownerUserId), company]))
  const items = users.map((user) => row(user, companies.get(String(user._id))))
  if (status === 'pending_review') items.sort((a, b) => new Date(a.submittedAt ?? a.createdAt) - new Date(b.submittedAt ?? b.createdAt))
  return { items, total: items.length, page: 1, pageSize: items.length }
}

/** Counts per status for the tab and the Moderation stats. */
export async function accountCounts() {
  const counts = await User.aggregate([{ $match: { role: 'recruiter', status: { $in: Object.keys(ACTIONS) } } }, { $group: { _id: '$status', count: { $sum: 1 } } }])
  return Object.fromEntries(Object.keys(ACTIONS).map((status) => [status, counts.find((count) => count._id === status)?.count ?? 0]))
}

async function recruiter(userId) {
  const user = await User.findOne({ _id: userId, role: 'recruiter', status: { $in: Object.keys(ACTIONS) } })
  if (!user) throw new AppError('NOT_FOUND')
  return user
}

/** §3.12: applicant, company record, contact checks, KYC files (opened through /admin/files), dates and history. */
export async function accountDetail(admin, userId) {
  const user = await recruiter(userId)
  return { ...(await accountRecord(admin, user)), actions: await allowedActions(admin, user.status) }
}

/** The review record of any recruiter (also the admin Recruiters detail page, M-161). */
export async function accountRecord(admin, user) {
  const company = await Company.findOne({ ownerUserId: user._id })
  const documents = company ? await KycDocument.find({ companyId: company._id }).sort({ uploadedAt: 1 }) : []
  const files = new Map((await File.find({ _id: { $in: documents.map((document) => document.fileId) } })).map((file) => [String(file._id), file]))
  const reviewers = new Map(
    (await User.find({ _id: { $in: (company?.reviewHistory ?? []).map((entry) => entry.by) } }, 'fullName')).map((reviewer) => [String(reviewer._id), reviewer.fullName]),
  )
  return {
    ...row(user, company),
    jobTitle: user.jobTitle ?? '',
    emailVerified: Boolean(user.emailVerifiedAt),
    phone: { e164: user.phone?.e164 ?? null, verified: Boolean(user.phone?.verifiedAt) },
    company: company ? await companyDto(company, admin._id) : null,
    documents: documents.map((document) => {
      const file = files.get(String(document.fileId))
      return { id: String(document._id), type: document.type, fileId: file ? String(file._id) : null, name: file?.originalName ?? null, mime: file?.mime ?? null, size: file?.size ?? null, uploadedAt: document.uploadedAt }
    }),
    history: (company?.reviewHistory ?? [])
      .map((entry) => ({ decision: entry.decision, reason: entry.reason ?? null, by: reviewers.get(String(entry.by)) ?? null, at: entry.at }))
      .reverse(),
  }
}

export async function createDefaultStages(company, language) {
  if (await PipelineStage.exists({ companyId: company._id })) return
  await PipelineStage.insertMany(
    DEFAULT_STAGES.map(({ key, tone, isEntry = false }, order) => {
      const name = t(language, `stages.${key}`)
      return { companyId: company._id, name, nameKey: name.toLocaleLowerCase(language), category: key, order, isEntry, tone }
    }),
  )
}

/** M-165, OQ-2: Approve, Reject (reason) or Suspend (reason, signs the recruiter out). */
export async function decideAccount(admin, userId, { decision, reason }) {
  const user = await recruiter(userId)
  if (!ACTIONS[user.status].includes(decision)) throw new AppError('CONFLICT', { params: { status: user.status } })
  if (!(await allowedActions(admin, user.status)).includes(decision)) throw new AppError('PERMISSION_DENIED', { params: { permission: 'users.deactivate' } })
  if (decision !== 'approved' && !reason) throw fieldError({ reason: 'required' })
  const company = await Company.findOne({ ownerUserId: user._id })
  const now = new Date()
  const previousStatus = user.status

  user.status = RESULT_STATUS[decision]
  if (decision === 'suspended') user.tokenVersion += 1
  await user.save()
  if (company) {
    if (decision === 'approved') company.verifiedAt ??= now
    company.reviewHistory.push({ decision, reason: reason || undefined, by: admin._id, at: now })
    await company.save()
    if (decision === 'approved') await createDefaultStages(company, user.language)
    // M-186, P4-D4: KYC files go 30 days after the latest decision.
    const fileIds = (await KycDocument.find({ companyId: company._id }, 'fileId')).map((document) => document.fileId)
    await File.updateMany({ _id: { $in: fileIds } }, { deleteAfter: new Date(now.getTime() + KYC_RETENTION_MS) })
  }

  const link = decision === 'approved' ? `${config.clientOrigin}/recruiter/sign-in` : `${config.clientOrigin}/recruiter/onboarding/review`
  await sendEmail({
    type: `recruiter_${decision}`,
    to: user.email,
    userId: user._id,
    language: user.language,
    params: { name: user.fullName, company: company?.legalName ?? '', reason: reason ?? '', link },
  })
  await recordAudit({
    type: previousStatus === 'suspended' ? 'moderation.account_reactivated' : `moderation.account_${decision}`,
    category: 'moderation',
    actor: actorFor(admin),
    target: { type: 'user', id: user._id },
    params: { name: user.fullName, company: company?.legalName, reason },
  })
}
