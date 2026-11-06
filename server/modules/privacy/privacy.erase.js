import bcrypt from 'bcryptjs'
import { fieldError } from '../../lib/errors.js'
import { removeFiles } from '../../lib/files.js'
import { recordAudit } from '../../lib/audit.js'
import { callStripe } from '../../lib/stripe.js'
import { EmailLog } from '../../lib/mail/emailLog.model.js'
import { ScheduledTask } from '../../jobs/models.js'
import { AuditEvent } from '../admin/admin.model.js'
import { AiCache, AiUsage, ExplanationFeedback } from '../ai/ai.model.js'
import { AlertMatch, JobAlert } from '../alerts/alerts.model.js'
import { Application } from '../applications/applications.model.js'
import { EmailToken, VerificationCode } from '../auth/auth.model.js'
import { CandidateProfile } from '../candidates/candidates.model.js'
import { Company, KycDocument } from '../companies/companies.model.js'
import { CvAccessRequest, CvVersion } from '../cv/cv.model.js'
import { CandidateNote, ProfileView, RecruiterActivity, ShortlistEntry } from '../discovery/discovery.model.js'
import { File, FileAccessLog } from '../files/files.model.js'
import { DocumentRequest, Interview } from '../interviews/interviews.model.js'
import { Job, SavedJob } from '../jobs/jobs.model.js'
import { Certificate, Enrollment, QuizAttempt } from '../learning/learning.model.js'
import { Embedding, MatchResult } from '../matching/matching.model.js'
import { scheduleRecompute } from '../matching/matching.service.js'
import { Conversation, Message } from '../messages/messages.model.js'
import { ModerationCase } from '../moderation/moderation.model.js'
import { Notification } from '../notifications/notifications.model.js'
import { Payment, Subscription } from '../payments/payments.model.js'
import { User } from '../users/users.model.js'
import { VerificationSubmission } from '../verification/verification.model.js'

/*
 * DELETE /me (M-188, M-189, OD15, OQ-6k, P12-Q2 … Q7): candidate erasure and recruiter deletion, after the password.
 * Stripe goes first, so a Stripe failure changes nothing; the user record goes last, so a failed run can be repeated.
 * Every collection is covered (COVERAGE, checked by privacy.test.js): deleted, anonymised ("Deleted user" is a null
 * name the client renders), or kept because it holds nothing about the person.
 */

/** Parameter keys that hold a person's name in notifications and audit entries (P12-Q3). */
const NAME_KEYS = ['name', 'candidate', 'payer', 'sender']

/** What erasure does to each collection; privacy.test.js fails when a model is missing here. */
export const COVERAGE = {
  User: 'deleted',
  CandidateProfile: 'deleted',
  CvVersion: 'deleted',
  CvAccessRequest: 'deleted (the candidate\'s, or every request of a deleted recruiter\'s company, P12-Q5)',
  VerificationSubmission: 'deleted',
  File: 'deleted (every file the person owns; a deleted company keeps its logo, OQ-6k)',
  FileAccessLog: 'deleted (downloads of the candidate\'s files, and by a deleted recruiter\'s company)',
  SavedJob: 'deleted',
  JobAlert: 'deleted',
  AlertMatch: 'deleted with the alerts',
  ExplanationFeedback: 'deleted',
  AiUsage: 'deleted',
  AiCache: 'deleted (rows about the person: subjectId)',
  Embedding: 'deleted (the candidate\'s vector)',
  MatchResult: 'deleted (the candidate\'s scores)',
  Application: 'deleted (candidate); kept on a deleted company\'s closed jobs (the display name stays)',
  ShortlistEntry: 'deleted',
  CandidateNote: 'deleted',
  RecruiterActivity: 'deleted',
  ProfileView: 'deleted',
  Conversation: 'kept as "Deleted user" with replies disabled (P12-Q2); a deleted company\'s threads stay closed',
  Message: 'deleted for both sides (candidate); a deleted company\'s messages stay for the candidates',
  Enrollment: 'deleted',
  QuizAttempt: 'deleted',
  Certificate: 'tombstone { code, status: no_longer_valid } (C18)',
  Subscription: 'deleted after the Stripe subscription is cancelled',
  Payment: 'kept with the payer anonymised (userId and payerName null)',
  Notification: 'deleted (own); others\' about the person\'s items keep the row with the name removed (P12-Q3)',
  AuditEvent: 'kept with the actor and names shown as "Deleted user"; one erasure entry is added (P12-Q7)',
  ModerationCase: 'kept with the reporter, owner and name shown as "Deleted user"',
  EmailToken: 'deleted',
  VerificationCode: 'deleted',
  EmailLog: 'deleted',
  ScheduledTask: 'pending tasks about the person\'s items deleted',
  Company: 'deleted recruiter: kept with the display name, logo and public profile; contact fields removed (M-189)',
  KycDocument: 'deleted with their files',
  Job: 'deleted recruiter: closed, author removed (M-189)',
  PipelineStage: 'kept (the company\'s stages; past applications point at them)',
  Course: 'kept (admin content)',
  AdminRole: 'kept (admins cannot erase themselves)',
  Permission: 'kept (catalogue)',
  Country: 'kept (catalogue)',
  LegalDocument: 'kept (catalogue)',
  Faq: 'kept (catalogue)',
  Plan: 'kept (catalogue)',
  AppConfig: 'kept (settings)',
  Counter: 'kept (payment references)',
  StripeEvent: 'kept (event ids only)',
  MatchingPolicy: 'kept (admin settings)',
  MatchingPolicyVersion: 'kept (admin settings)',
  ReportExport: 'kept (admin reports hold aggregates only)',
  JobRun: 'kept (scheduler slots)',
  Interview: "deleted with any audio (the candidate's, or every interview of a deleted recruiter's company; §3.23)",
  DocumentRequest: "deleted with both sides' files (the candidate's, or every request of a deleted recruiter's company; §3.23)",
}

/** §3.23: interviews and document requests of the pair go with every file in them and their pending tasks. */
async function removeInterviewData(filter) {
  const [interviews, requests] = await Promise.all([Interview.find(filter), DocumentRequest.find(filter)])
  await removeFiles([...interviews.map((item) => item.recording?.fileId), ...requests.flatMap((item) => [item.attachmentFileId, ...item.items.map((entry) => entry.fileId)])])
  await ScheduledTask.deleteMany({ status: 'pending', 'payload.interviewId': { $in: interviews.map((item) => String(item._id)) } })
  await Promise.all([Interview.deleteMany(filter), DocumentRequest.deleteMany(filter)])
}

async function checkPassword(user, password) {
  if (!(await bcrypt.compare(password, user.passwordHash ?? ''))) throw fieldError({ currentPassword: 'invalid' })
}

/** OD15: the subscription is cancelled at once (no refund), then the Customer is deleted. An already missing object is fine. */
async function closeStripe(user) {
  const ignoreMissing = (error) => {
    if (error.code !== 'NOT_FOUND') throw error
  }
  const subscription = await Subscription.findOne({ userId: user._id })
  if (subscription?.stripeSubscriptionId && !['canceled', 'incomplete_expired'].includes(subscription.status)) {
    await callStripe((s) => s.subscriptions.cancel(subscription.stripeSubscriptionId)).catch(ignoreMissing)
  }
  if (user.stripeCustomerId) await callStripe((s) => s.customers.del(user.stripeCustomerId)).catch(ignoreMissing)
}

/** P12-Q3: the person's name leaves other people's notifications and the audit entries about their items. */
async function removeName(user, itemIds) {
  const ids = itemIds.map(String)
  for (const key of NAME_KEYS) {
    const named = { [`params.${key}`]: user.fullName }
    await Notification.updateMany({ 'target.id': { $in: ids }, ...named }, { $set: { [`params.${key}`]: null } })
    await AuditEvent.updateMany({ $or: [{ 'actor.id': user._id }, { 'target.id': { $in: itemIds } }], ...named }, { $set: { [`params.${key}`]: null } })
  }
  await AuditEvent.updateMany({ 'actor.id': user._id }, { $set: { 'actor.id': null, 'actor.name': null } })
  await ModerationCase.updateMany({ 'reports.reporterId': user._id }, { $set: { 'reports.$[mine].reporterId': null } }, { arrayFilters: [{ 'mine.reporterId': user._id }] })
  await ModerationCase.updateMany({ ownerId: user._id }, { $set: { ownerId: null } })
  await ModerationCase.updateMany({ targetId: { $in: itemIds }, targetName: user.fullName }, { $set: { targetName: null } })
}

/** Records every account owns: alerts, learning, tokens, logs, AI use; certificates become tombstones (C18; their PDFs go with the files). */
async function removeOwnRecords(user) {
  await Certificate.updateMany({ userId: user._id }, { $set: { userId: null, holderName: null, pdfFileId: null, status: 'no_longer_valid' } })
  const alerts = await JobAlert.find({ candidateId: user._id }, '_id')
  await Promise.all([
    AlertMatch.deleteMany({ alertId: { $in: alerts.map((alert) => alert._id) } }),
    JobAlert.deleteMany({ candidateId: user._id }),
    Enrollment.deleteMany({ userId: user._id }),
    QuizAttempt.deleteMany({ userId: user._id }),
    Subscription.deleteMany({ userId: user._id }),
    Payment.updateMany({ userId: user._id }, { $set: { userId: null, payerName: null } }),
    Notification.deleteMany({ userId: user._id }),
    EmailToken.deleteMany({ userId: user._id }),
    VerificationCode.deleteMany({ userId: user._id }),
    EmailLog.deleteMany({ $or: [{ userId: user._id }, { to: user.email }] }),
    AiUsage.deleteMany({ userId: user._id }),
  ])
}

async function eraseCandidate(user) {
  const [applications, conversations, submissions, payments, cvVersions] = await Promise.all([
    Application.find({ candidateId: user._id }, '_id'),
    Conversation.find({ candidateId: user._id }, '_id'),
    VerificationSubmission.find({ userId: user._id }, '_id'),
    Payment.find({ userId: user._id }, '_id'),
    CvVersion.find({ userId: user._id }, '_id'),
  ])
  const conversationIds = conversations.map((conversation) => conversation._id)
  const messageIds = (await Message.find({ conversationId: { $in: conversationIds } }, '_id')).map((message) => message._id)
  const applicationIds = applications.map((application) => application._id)
  await removeName(user, [user._id, ...applicationIds, ...conversationIds, ...messageIds, ...submissions.map((item) => item._id), ...payments.map((item) => item._id)])

  // P12-Q2: the thread stays as "Deleted user", empty and closed for replies.
  await Message.deleteMany({ conversationId: { $in: conversationIds } })
  await Conversation.updateMany({ _id: { $in: conversationIds } }, { $set: { lastMessagePreview: '', 'unread.candidate': 0, 'unread.recruiter': 0, closedAt: new Date() } })
  await ScheduledTask.deleteMany({
    status: 'pending',
    $or: [{ 'payload.applicationId': { $in: applicationIds.map(String) } }, { 'payload.conversationId': { $in: conversationIds.map(String) } }],
  })
  await Promise.all([
    Application.deleteMany({ candidateId: user._id }),
    SavedJob.deleteMany({ candidateId: user._id }),
    ExplanationFeedback.deleteMany({ candidateId: user._id }),
    AiCache.deleteMany({ subjectId: user._id }),
    Embedding.deleteMany({ ownerType: 'candidate', ownerId: user._id }),
    MatchResult.deleteMany({ candidateId: user._id }),
    ShortlistEntry.deleteMany({ candidateId: user._id }),
    CandidateNote.deleteMany({ candidateId: user._id }),
    RecruiterActivity.deleteMany({ candidateId: user._id }),
    ProfileView.deleteMany({ candidateId: user._id }),
    CvAccessRequest.deleteMany({ candidateId: user._id }),
    FileAccessLog.deleteMany({ $or: [{ ownerId: user._id }, { accessorId: user._id }] }),
    CvVersion.deleteMany({ _id: { $in: cvVersions.map((version) => version._id) } }),
    VerificationSubmission.deleteMany({ userId: user._id }),
    CandidateProfile.deleteMany({ userId: user._id }),
  ])
  await removeInterviewData({ candidateId: user._id })
  await removeOwnRecords(user)
  await removeFiles((await File.find({ ownerId: user._id }, '_id')).map((file) => file._id))
  // The jobs' relevant counts no longer include the candidate (U7).
  await scheduleRecompute('candidate', user._id)
}

async function deleteRecruiter(user) {
  const company = user.companyId && (await Company.findById(user.companyId))
  const companyFilter = { companyId: company?._id ?? null }
  const [jobs, conversations, payments] = await Promise.all([Job.find(companyFilter, '_id'), Conversation.find(companyFilter, '_id'), Payment.find({ userId: user._id }, '_id')])
  const jobIds = jobs.map((job) => job._id)
  await removeName(user, [user._id, ...(company ? [company._id] : []), ...payments.map((item) => item._id)])

  if (company) {
    // M-189: jobs closed and the author removed; applications and threads keep the company display name.
    const now = new Date()
    await Job.updateMany({ companyId: company._id, status: { $ne: 'closed' } }, { $set: { status: 'closed', closedAt: now } })
    await Job.updateMany({ companyId: company._id }, { $set: { createdBy: null } })
    await Conversation.updateMany({ companyId: company._id }, { $set: { closedAt: now } })
    const kyc = await KycDocument.find({ companyId: company._id }, 'fileId')
    await removeFiles(kyc.map((document) => document.fileId))
    await Promise.all([
      KycDocument.deleteMany({ companyId: company._id }),
      // OQ-6k, P12-Q5: the company's notes, shortlist, activity, profile views, CV requests and CV downloads.
      CandidateNote.deleteMany(companyFilter),
      ShortlistEntry.deleteMany(companyFilter),
      RecruiterActivity.deleteMany(companyFilter),
      ProfileView.deleteMany(companyFilter),
      CvAccessRequest.deleteMany(companyFilter),
      FileAccessLog.deleteMany({ $or: [companyFilter, { accessorId: user._id }] }),
      ScheduledTask.deleteMany({
        status: 'pending',
        $or: [{ 'payload.jobId': { $in: jobIds.map(String) } }, { 'payload.conversationId': { $in: conversations.map((item) => String(item._id)) } }],
      }),
      Company.updateOne({ _id: company._id }, { $set: { deletedAt: now }, $unset: { businessEmail: '', businessAddress: '', registrationDetails: '' } }),
    ])
    await removeInterviewData(companyFilter)
  }
  await removeOwnRecords(user)
  const keep = company?.logoFileId ? [String(company.logoFileId)] : []
  await removeFiles((await File.find({ ownerId: user._id }, '_id')).map((file) => file._id).filter((id) => !keep.includes(String(id))))
  for (const jobId of jobIds) await scheduleRecompute('job', jobId)
}

/** DELETE /me: the candidate's erasure or the recruiter's account deletion; the client then signs out. */
export async function deleteAccount(user, { currentPassword }) {
  await checkPassword(user, currentPassword)
  // Late Stripe webhooks for this account are ignored from now on (payments.service ownerOf).
  await User.updateOne({ _id: user._id }, { $set: { erasedAt: new Date() } })
  try {
    await closeStripe(user)
  } catch (error) {
    await User.updateOne({ _id: user._id }, { $unset: { erasedAt: '' } })
    throw error
  }
  await (user.role === 'candidate' ? eraseCandidate(user) : deleteRecruiter(user))
  // P12-Q7: one entry for the admins, with no name or email.
  await recordAudit({ type: 'access.account_deleted', category: 'access', actor: { type: 'user', id: null, name: null }, target: { type: 'user' }, params: { accountRole: user.role } })
  await User.deleteOne({ _id: user._id })
}
