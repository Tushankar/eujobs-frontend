import { access } from 'node:fs/promises'
import { extname } from 'node:path'
import { ZipArchive } from 'archiver'
import { toCsv } from '../../lib/csv.js'
import { absolutePath } from '../../lib/files.js'
import { t } from '../../lib/i18n.js'
import { Application } from '../applications/applications.model.js'
import { JobAlert } from '../alerts/alerts.model.js'
import { ExplanationFeedback } from '../ai/ai.model.js'
import { CandidateProfile } from '../candidates/candidates.model.js'
import { Company, KycDocument } from '../companies/companies.model.js'
import { CvAccessRequest, CvVersion } from '../cv/cv.model.js'
import { CandidateNote } from '../discovery/discovery.model.js'
import { File, FileAccessLog } from '../files/files.model.js'
import { Job, SavedJob } from '../jobs/jobs.model.js'
import { Certificate, Course, Enrollment, QuizAttempt } from '../learning/learning.model.js'
import { Conversation, Message } from '../messages/messages.model.js'
import { Notification } from '../notifications/notifications.model.js'
import { emailSwitches } from '../notifications/notifications.service.js'
import { Payment, Subscription } from '../payments/payments.model.js'
import { User } from '../users/users.model.js'
import { VerificationSubmission } from '../verification/verification.model.js'

/*
 * GET /me/export (M-190, OD15, P12-Q4): a ZIP of JSON files plus the person's own files.
 * Candidate: every own record, the CV versions, photo, certificate PDFs and the uploaded certificate and evidence
 * files; recruiter notes about the candidate are never included (U31). Recruiter: account, company, jobs, notes,
 * messages, payments, learning and notifications, the KYC files and the logo, plus a CSV summary in their language.
 */

const day = (date) => date.toISOString().slice(0, 10)
const safeName = (name) => String(name).replace(/[\\/:*?"<>|]+/g, '_')
const byId = (docs) => new Map(docs.map((doc) => [String(doc._id), doc]))
const omit = (doc, keys) => doc && Object.fromEntries(Object.entries(doc).filter(([key]) => !keys.includes(key)))

function account(user) {
  const fields = ['role', 'email', 'fullName', 'jobTitle', 'status', 'phone', 'language', 'pickerCountry', 'timezone', 'legal', 'privacy', 'emailVerifiedAt', 'lastLoginAt', 'createdAt']
  const picked = Object.fromEntries(fields.filter((field) => user[field] !== undefined).map((field) => [field, user[field]]))
  if (user.role !== 'candidate') delete picked.privacy
  return { ...picked, emailSwitches: emailSwitches(user) }
}

/** The conversations of a candidate or a company, each with its messages, oldest first. */
async function conversations(filter, nameOf) {
  const threads = await Conversation.find(filter).sort({ lastMessageAt: -1 }).lean()
  const messages = await Message.find({ conversationId: { $in: threads.map((thread) => thread._id) } }).sort({ createdAt: 1 }).lean()
  const jobs = byId(await Job.find({ _id: { $in: threads.map((thread) => thread.jobId).filter(Boolean) } }, 'title').lean())
  return Promise.all(
    threads.map(async (thread) => ({
      with: await nameOf(thread),
      job: jobs.get(String(thread.jobId))?.title ?? null,
      startedBy: thread.startedBy,
      messages: messages
        .filter((message) => String(message.conversationId) === String(thread._id))
        .map((message) => ({ from: message.senderRole, body: message.body, sentAt: message.createdAt, readAt: message.readAt ?? null })),
    })),
  )
}

async function payments(user) {
  const rows = await Payment.find({ userId: user._id }).sort({ paidAt: -1 }).lean()
  return rows.map(({ reference, kind, itemName, amountMinor, currency, status, failureReason, method, receiptUrl, periodStart, periodEnd, paidAt }) => ({
    reference,
    kind,
    item: itemName,
    amountMinor,
    currency,
    status,
    failureReason: failureReason ?? null,
    method: method ?? null,
    receiptUrl: receiptUrl ?? null,
    periodStart: periodStart ?? null,
    periodEnd: periodEnd ?? null,
    paidAt: paidAt ?? null,
  }))
}

async function learning(user) {
  const [enrollments, attempts, certificates] = await Promise.all([
    Enrollment.find({ userId: user._id }).lean(),
    QuizAttempt.find({ userId: user._id }).sort({ submittedAt: 1 }).lean(),
    Certificate.find({ userId: user._id }).lean(),
  ])
  const courses = byId(await Course.find({ _id: { $in: [...enrollments, ...attempts].map((item) => item.courseId) } }, 'title').lean())
  const title = (id) => courses.get(String(id))?.title ?? null
  return {
    enrollments: enrollments.map(({ courseId, source, enrolledAt, lessons, quizBestScore, quizPassedAt, completedAt }) => ({
      course: title(courseId),
      source,
      enrolledAt,
      completedLessons: lessons.filter((lesson) => lesson.completedAt).length,
      quizBestScore: quizBestScore ?? null,
      quizPassedAt: quizPassedAt ?? null,
      completedAt: completedAt ?? null,
    })),
    quizAttempts: attempts.map(({ courseId, scorePercent, passed, submittedAt }) => ({ course: title(courseId), scorePercent, passed, submittedAt })),
    certificates: certificates.map(({ code, courseTitle, holderName, language, issuedAt, status }) => ({ code, course: courseTitle, holderName, language, issuedAt, status })),
    pdfs: certificates.filter((certificate) => certificate.pdfFileId).map((certificate) => ({ fileId: certificate.pdfFileId, name: `files/certificates/${certificate.code}.pdf` })),
  }
}

const notifications = async (user) =>
  (await Notification.find({ userId: user._id }).sort({ at: -1 }).lean()).map(({ type, params, count, at, readAt }) => ({ type, params, count, at, readAt: readAt ?? null }))

async function candidateExport(user) {
  const [profile, cvVersions, requests, downloads, submissions, applications, saved, alerts, subscription, feedback] = await Promise.all([
    CandidateProfile.findOne({ userId: user._id }).lean(),
    CvVersion.find({ userId: user._id }).sort({ number: 1 }).lean(),
    CvAccessRequest.find({ candidateId: user._id }).sort({ createdAt: -1 }).lean(),
    FileAccessLog.find({ ownerId: user._id }).sort({ at: -1 }).lean(),
    VerificationSubmission.find({ userId: user._id }).sort({ submittedAt: 1 }).lean(),
    Application.find({ candidateId: user._id }).sort({ appliedAt: -1 }).lean(),
    SavedJob.find({ candidateId: user._id }).lean(),
    JobAlert.find({ candidateId: user._id }).lean(),
    Subscription.findOne({ userId: user._id }).lean(),
    ExplanationFeedback.find({ candidateId: user._id }).lean(),
  ])
  const jobs = byId(await Job.find({ _id: { $in: [...applications, ...saved, ...feedback].map((item) => item.jobId) } }, 'title companyId').lean())
  const companies = byId(await Company.find({ _id: { $in: [...[...jobs.values()].map((job) => job.companyId), ...requests.map((item) => item.companyId), ...downloads.map((item) => item.companyId)] } }, 'displayName').lean())
  const companyName = (id) => companies.get(String(id))?.displayName ?? null
  const jobOf = (id) => jobs.get(String(id))
  const versionNumber = byId(cvVersions)
  const { pdfs, ...learned } = await learning(user)

  const data = {
    'account.json': account(user),
    'profile.json': omit(profile, ['_id', 'userId', '__v']),
    'cv-versions.json': cvVersions.map(({ number, originalName, mime, size, extractedText, noReadableText, snapshot, createdAt }) => ({ number, originalName, mime, size, extractedText: extractedText ?? null, noReadableText: Boolean(noReadableText), snapshot: snapshot ?? null, uploadedAt: createdAt })),
    'cv-requests.json': requests.map(({ companyId, reason, details, status, cvVersionId, decidedAt, createdAt }) => ({ company: companyName(companyId), reason, details: details ?? null, status, sharedVersion: versionNumber.get(String(cvVersionId))?.number ?? null, requestedAt: createdAt, decidedAt: decidedAt ?? null })),
    'cv-downloads.json': downloads.map(({ companyId, at }) => ({ company: companyName(companyId), at })),
    'verification.json': submissions.map(({ category, evidenceType, status, submittedAt, reviewedAt, reason }) => ({ category, evidenceType: evidenceType ?? null, status, submittedAt, reviewedAt: reviewedAt ?? null, reason: reason ?? null })),
    // U31: the company's notes, stages and actors are not part of the candidate's export.
    'applications.json': applications.map(({ jobId, status, coverNote, appliedAt, withdrawnAt, notSelectedAt, cvVersionId, history }) => ({
      job: jobOf(jobId)?.title ?? null,
      company: companyName(jobOf(jobId)?.companyId),
      status,
      coverNote: coverNote ?? null,
      cvVersion: versionNumber.get(String(cvVersionId))?.number ?? null,
      appliedAt,
      withdrawnAt: withdrawnAt ?? null,
      notSelectedAt: notSelectedAt ?? null,
      history: history.map((entry) => ({ status: entry.status, at: entry.at })),
    })),
    'conversations.json': await conversations({ candidateId: user._id }, async (thread) => (await Company.findById(thread.companyId, 'displayName'))?.displayName ?? null),
    'saved-jobs.json': saved.map(({ jobId, createdAt }) => ({ job: jobOf(jobId)?.title ?? null, company: companyName(jobOf(jobId)?.companyId), savedAt: createdAt })),
    'job-alerts.json': alerts.map(({ name, keywords, location, country, language, frequency, active, createdAt }) => ({ name, keywords, location: location ?? null, country, language, frequency, active, createdAt })),
    'subscription.json': subscription && { plan: subscription.planKey, status: subscription.status, currency: subscription.currency ?? null, amountMinor: subscription.amountMinor ?? null, currentPeriodStart: subscription.currentPeriodStart ?? null, currentPeriodEnd: subscription.currentPeriodEnd ?? null, cancelAtPeriodEnd: subscription.cancelAtPeriodEnd, startedAt: subscription.startedAt ?? null },
    'payments.json': await payments(user),
    'learning.json': learned,
    'ai-feedback.json': feedback.map(({ jobId, value, updatedAt }) => ({ job: jobOf(jobId)?.title ?? null, value, at: updatedAt })),
    'notifications.json': await notifications(user),
  }
  const files = [
    ...cvVersions.filter((version) => version.fileId).map((version) => ({ fileId: version.fileId, name: `files/cv/v${version.number}-${safeName(version.originalName)}` })),
    ...(profile?.photo?.fileId ? [{ fileId: profile.photo.fileId, name: 'files/photo' }] : []),
    ...(profile?.certificates ?? []).filter((entry) => entry.fileId).map((entry, index) => ({ fileId: entry.fileId, name: `files/profile-certificates/${index + 1}-${safeName(entry.name)}` })),
    ...submissions.filter((item) => item.fileId).map((item, index) => ({ fileId: item.fileId, name: `files/verification/${index + 1}-${item.category}` })),
    ...pdfs,
  ]
  return { data, files }
}

async function recruiterExport(user) {
  const company = user.companyId ? await Company.findById(user.companyId).lean() : null
  const companyFilter = { companyId: company?._id ?? null }
  const [jobs, notes, kyc] = await Promise.all([Job.find(companyFilter).sort({ createdAt: -1 }).lean(), CandidateNote.find(companyFilter).lean(), KycDocument.find(companyFilter).lean()])
  const candidates = byId(await User.find({ _id: { $in: notes.map((note) => note.candidateId) } }, 'fullName').lean())
  const { pdfs, ...learned } = await learning(user)
  const threads = await conversations(companyFilter, async (thread) => (await User.findById(thread.candidateId, 'fullName'))?.fullName ?? null)
  const paid = await payments(user)

  const data = {
    'account.json': account(user),
    'company.json': omit(company, ['_id', 'ownerUserId', '__v']),
    'jobs.json': jobs.map((job) => omit(job, ['_id', 'companyId', 'createdBy', '__v', 'relevantCount', 'relevantComputedAt', 'contentHash'])),
    'notes.json': notes.map(({ candidateId, text, createdAt, editedAt }) => ({ candidate: candidates.get(String(candidateId))?.fullName ?? null, text, createdAt, editedAt: editedAt ?? null })),
    'conversations.json': threads,
    'payments.json': paid,
    'learning.json': learned,
    'notifications.json': await notifications(user),
  }
  const label = (key) => t(user.language, `csv.export.${key}`)
  const jobCounts = Object.entries(Object.groupBy(jobs, (job) => job.status)).map(([status, list]) => [`${label('jobs')}: ${t(user.language, `labels.jobStatus.${status}`)}`, list.length])
  const paidTotals = Object.entries(Object.groupBy(paid.filter((row) => row.status === 'paid'), (row) => row.currency)).map(([currency, rows]) => [`${label('paid')} (${currency})`, (rows.reduce((sum, row) => sum + row.amountMinor, 0) / 100).toFixed(2)])
  const summary = [
    [label('field'), label('value')],
    [label('name'), user.fullName],
    [label('email'), user.email],
    [label('company'), company?.displayName ?? ''],
    ...jobCounts,
    [label('notes'), notes.length],
    [label('conversations'), threads.length],
    [label('messages'), threads.reduce((sum, thread) => sum + thread.messages.length, 0)],
    [label('payments'), paid.length],
    ...paidTotals,
    [label('notifications'), data['notifications.json'].length],
    [label('exportedAt'), new Date().toISOString()],
  ]
  data['summary.csv'] = toCsv(summary)
  const files = [
    ...kyc.filter((document) => document.fileId).map((document) => ({ fileId: document.fileId, name: `files/kyc/${document.type}` })),
    ...(company?.logoFileId ? [{ fileId: company.logoFileId, name: 'files/logo' }] : []),
    ...pdfs,
  ]
  return { data, files }
}

/** Streams the ZIP. Files are listed first and only the ones present on disk are added (the stream cannot fail half-way). */
export async function sendExport(user, res) {
  const { data, files } = await (user.role === 'candidate' ? candidateExport(user) : recruiterExport(user))
  const records = byId(await File.find({ _id: { $in: files.map((file) => file.fileId) } }).lean())
  const present = []
  for (const entry of files) {
    const file = records.get(String(entry.fileId))
    if (!file) continue
    const path = absolutePath(file)
    const ext = extname(file.path)
    if (await access(path).then(() => true, () => false)) present.push({ path, name: entry.name.endsWith(ext) ? entry.name : `${entry.name}${ext}` })
  }
  const archive = new ZipArchive({ zlib: { level: 9 } })
  res.attachment(`local-workman-export-${day(new Date())}.zip`)
  res.set('Cache-Control', 'no-store')
  archive.pipe(res)
  for (const [name, value] of Object.entries(data)) archive.append(typeof value === 'string' ? value : JSON.stringify(value, null, 2), { name })
  for (const { path, name } of present) archive.file(path, { name })
  await archive.finalize()
}
