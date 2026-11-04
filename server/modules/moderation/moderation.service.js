import { config } from '../../config/env.js'
import { LIMITS } from '../../config/limits.js'
import { actorFor, recordAudit } from '../../lib/audit.js'
import { AppError, fieldError } from '../../lib/errors.js'
import { signedUrl } from '../../lib/files.js'
import { interpolate, t } from '../../lib/i18n.js'
import { sendEmail } from '../../lib/mailer.js'
import { CandidateProfile } from '../candidates/candidates.model.js'
import { loadProfile, removePhoto } from '../candidates/candidates.service.js'
import { Company } from '../companies/companies.model.js'
import { logoUrls } from '../companies/companies.service.js'
import { File } from '../files/files.model.js'
import { Job } from '../jobs/jobs.model.js'
import { scheduleRecompute } from '../matching/matching.service.js'
import { Conversation, Message } from '../messages/messages.model.js'
import { User } from '../users/users.model.js'
import { ModerationCase } from './moderation.model.js'

/*
 * Content moderation (M-164, M-167, U20, OQ-1, P10-Q10, P10-Q12). Candidates report jobs, companies and messages;
 * approved recruiters report candidate profiles and messages. Admins also open job cases from Jobs. Restrict pauses
 * and locks a job, or hides a profile from discovery (optionally removing its photo); dismissing a restricted case
 * lifts that. Company and message cases offer Dismiss only.
 */
const DAY_MS = 24 * 60 * 60 * 1000
const RESTRICTABLE = ['job', 'candidate_profile']
const HIGH_PRIORITY = ['scam_or_fraud', 'discriminatory']

/** The target a user may report, with the name shown in the queue and the account a decision is emailed to. */
async function reportTarget(user, company, { targetType, targetId }) {
  const allowed = user.role === 'candidate' ? ['job', 'company', 'message'] : ['candidate_profile', 'message']
  if (!allowed.includes(targetType)) throw new AppError('FORBIDDEN')
  if (targetType === 'job') {
    const job = await Job.findOne({ _id: targetId, status: { $ne: 'draft' } })
    if (!job) throw new AppError('NOT_FOUND')
    return { name: job.title, ownerId: (await Company.findById(job.companyId, 'ownerUserId'))?.ownerUserId }
  }
  if (targetType === 'company') {
    const target = await Company.findById(targetId, 'displayName ownerUserId')
    if (!target) throw new AppError('NOT_FOUND')
    return { name: target.displayName, ownerId: target.ownerUserId }
  }
  if (targetType === 'candidate_profile') {
    const candidate = await User.findOne({ _id: targetId, role: 'candidate' }, 'fullName')
    if (!candidate) throw new AppError('NOT_FOUND')
    return { name: candidate.fullName, ownerId: candidate._id }
  }
  // A message from the other side of one of the reporter's own threads; the excerpt is it and up to 5 earlier ones.
  const message = await Message.findById(targetId)
  const conversation = message && (await Conversation.findById(message.conversationId))
  const mine = conversation && (user.role === 'candidate' ? conversation.candidateId.equals(user._id) : conversation.companyId.equals(company._id))
  if (!mine || message.senderRole === user.role) throw new AppError('NOT_FOUND')
  const earlier = await Message.find({ conversationId: conversation._id, createdAt: { $lt: message.createdAt } })
    .sort({ createdAt: -1 })
    .limit(LIMITS.report.excerptEarlier)
  const excerpt = [...earlier.reverse(), message].map((item) => ({ senderRole: item.senderRole, body: item.body, at: item.createdAt, reported: item._id.equals(message._id) }))
  return { name: (await User.findById(message.senderId, 'fullName'))?.fullName, ownerId: message.senderId, excerpt }
}

/** POST /reports (U20): at most 10 a day per user, one open case per reporter and target; reports on a target share its open case. */
export async function report(user, company, body) {
  const since = new Date(Date.now() - DAY_MS)
  const [today] = await ModerationCase.aggregate([
    { $match: { 'reports.reporterId': user._id } },
    { $unwind: '$reports' },
    { $match: { 'reports.reporterId': user._id, 'reports.at': { $gte: since } } },
    { $count: 'count' },
  ])
  if ((today?.count ?? 0) >= LIMITS.report.perDay) throw new AppError('RATE_LIMITED', { params: { reason: 'reports_per_day', limit: LIMITS.report.perDay } })

  const target = await reportTarget(user, company, body)
  const entry = { reporterId: user._id, reason: body.reason, details: body.details || undefined, at: new Date() }
  const open = await ModerationCase.findOne({ targetType: body.targetType, targetId: body.targetId, status: 'open' })
  if (open?.reports.some((item) => item.reporterId.equals(user._id))) throw new AppError('CONFLICT', { params: { reason: 'already_reported' } })
  if (open) {
    open.reports.push(entry)
    await open.save()
  } else {
    await ModerationCase.create({
      targetType: body.targetType,
      targetId: body.targetId,
      targetName: target.name,
      ownerId: target.ownerId,
      reports: [entry],
      excerpt: target.excerpt ?? [],
      openedBy: 'user',
      history: [{ action: 'opened', at: entry.at }],
    })
  }
  await recordAudit({
    type: 'moderation.content_reported',
    category: 'moderation',
    actor: actorFor(user),
    target: { type: body.targetType, id: body.targetId },
    params: { name: target.name, targetType: body.targetType, reason: body.reason },
  })
  return { reported: true }
}

/** Admin "Open case" from Jobs (M-164, P10-Q4): not on drafts; an open case for the job is returned as it is. */
export async function openJobCase(admin, jobId, { reason, details }) {
  const job = await Job.findById(jobId)
  if (!job) throw new AppError('NOT_FOUND')
  if (job.status === 'draft') throw new AppError('CONFLICT', { params: { status: 'draft' } })
  const open = await ModerationCase.findOne({ targetType: 'job', targetId: job._id, status: 'open' })
  if (open) return { id: String(open._id), created: false }
  const at = new Date()
  const created = await ModerationCase.create({
    targetType: 'job',
    targetId: job._id,
    targetName: job.title,
    ownerId: (await Company.findById(job.companyId, 'ownerUserId'))?.ownerUserId,
    reports: [{ reporterId: admin._id, reason, details: details || undefined, at }],
    openedBy: 'admin',
    history: [{ action: 'opened', by: admin._id, byName: admin.fullName, at }],
  })
  await recordAudit({
    type: 'moderation.case_opened',
    category: 'moderation',
    actor: actorFor(admin),
    target: { type: 'job', id: job._id },
    params: { name: job.title, reason },
  })
  return { id: String(created._id), created: true }
}

/* ---------- admin queue ---------- */

const priorityOf = (item) => (item.reports.some((entry) => HIGH_PRIORITY.includes(entry.reason)) ? 'high' : 'standard')

function caseDto(item) {
  const latest = item.reports.at(-1)
  return {
    id: String(item._id),
    targetType: item.targetType,
    targetId: String(item.targetId),
    targetName: item.targetName ?? null,
    status: item.status,
    priority: priorityOf(item),
    reasons: [...new Set(item.reports.map((entry) => entry.reason))],
    reportCount: item.reports.length,
    latestDetails: latest?.details ?? null,
    openedBy: item.openedBy,
    reportedAt: latest?.at ?? item.createdAt,
    decision: item.decision?.action ? { action: item.decision.action, reason: item.decision.reason ?? null, at: item.decision.at } : null,
    actions: actionsOf(item),
  }
}

/** M-167, OQ-1: open → Dismiss (and Restrict for jobs and profiles); a restricted case can only be dismissed (lifting it). */
function actionsOf(item) {
  if (item.status === 'restricted') return ['dismiss']
  if (item.status === 'dismissed') return []
  return RESTRICTABLE.includes(item.targetType) ? ['dismiss', 'restrict'] : ['dismiss']
}

/** The content queue: open cases first, then decided ones, newest report first. */
export async function listCases() {
  const cases = await ModerationCase.find().sort({ updatedAt: -1 })
  const items = cases.map(caseDto).sort((a, b) => Number(b.status === 'open') - Number(a.status === 'open') || b.reportedAt - a.reportedAt)
  return { items, total: items.length, page: 1, pageSize: items.length }
}

export async function summary() {
  const [open, decided] = await Promise.all([ModerationCase.countDocuments({ status: 'open' }), ModerationCase.countDocuments({ status: { $ne: 'open' } })])
  return { contentOpen: open, contentDecided: decided }
}

/** What the admin reviews: the target as it is now, every report with its reporter, the excerpt and the history. */
async function targetView(admin, item) {
  if (item.targetType === 'job') {
    const job = await Job.findById(item.targetId)
    const company = job && (await Company.findById(job.companyId, 'displayName logoFileId'))
    const logoUrl = company ? (await logoUrls([company], admin._id)).get(String(company._id)) : null
    return (
      job && {
        title: job.title,
        company: company?.displayName ?? null,
        companyId: company ? String(company._id) : null,
        companyLogoUrl: logoUrl ?? null,
        status: job.status,
        brief: job.brief ?? '',
        restricted: Boolean(job.restricted?.at),
      }
    )
  }
  if (item.targetType === 'candidate_profile') {
    const [user, profile] = await Promise.all([User.findById(item.targetId, 'fullName'), CandidateProfile.findOne({ userId: item.targetId })])
    const photo = profile?.photo?.fileId && (await File.findById(profile.photo.fileId))
    return (
      user && {
        name: user.fullName,
        headline: profile?.headline ?? '',
        about: profile?.about ?? '',
        photoUrl: photo ? signedUrl(photo, admin._id) : null,
        restricted: Boolean(profile?.restricted?.at),
      }
    )
  }
  if (item.targetType === 'company') {
    const company = await Company.findById(item.targetId, 'displayName description logoFileId')
    return company && { id: String(company._id), name: company.displayName, description: company.description ?? '', logoUrl: (await logoUrls([company], admin._id)).get(String(company._id)) ?? null }
  }
  return { name: item.targetName }
}

export async function caseDetail(admin, id) {
  const item = await ModerationCase.findById(id)
  if (!item) throw new AppError('NOT_FOUND')
  const people = new Map((await User.find({ _id: { $in: item.reports.map((entry) => entry.reporterId) } }, 'fullName role')).map((user) => [String(user._id), user]))
  return {
    ...caseDto(item),
    target: await targetView(admin, item),
    reports: item.reports.map((entry) => {
      const reporter = people.get(String(entry.reporterId))
      return { reporter: reporter ? { name: reporter.fullName, role: reporter.role } : null, reason: entry.reason, details: entry.details ?? null, at: entry.at }
    }),
    excerpt: item.excerpt.map(({ senderRole, body, at, reported }) => ({ senderRole, body, at, reported: Boolean(reported) })),
    history: item.history.map(({ action, reason, photoRemoved, byName, at }) => ({ action, reason: reason ?? null, photoRemoved: Boolean(photoRemoved), by: byName ?? null, at })),
  }
}

/* ---------- decisions ---------- */

async function restrictTarget(item, admin, reason, removePhotoToo) {
  const restricted = { reason, by: admin._id, at: new Date(), caseId: item._id }
  if (item.targetType === 'job') {
    const job = await Job.findById(item.targetId)
    if (!job) throw new AppError('NOT_FOUND')
    if (job.status === 'published') job.status = 'paused'
    job.restricted = restricted
    await job.save()
    await scheduleRecompute('job', job._id)
    return { link: `${config.clientOrigin}/recruiter/jobs/${job._id}` }
  }
  const [user, profile] = await Promise.all([User.findById(item.targetId), loadProfile(item.targetId)])
  profile.restricted = restricted
  await profile.save()
  // M-013: the photo goes through the profile service, so completeness and matching follow.
  const photoRemoved = Boolean(removePhotoToo && profile.photo?.fileId)
  if (photoRemoved) await removePhoto(user, profile)
  else await scheduleRecompute('candidate', user._id)
  return { link: `${config.clientOrigin}/candidate/profile`, photoRemoved }
}

async function liftTarget(item) {
  if (item.targetType === 'job') {
    await Job.updateOne({ _id: item.targetId, 'restricted.caseId': item._id }, { $unset: { restricted: 1 } })
    return { link: `${config.clientOrigin}/recruiter/jobs/${item.targetId}` }
  }
  await CandidateProfile.updateOne({ userId: item.targetId, 'restricted.caseId': item._id }, { $unset: { restricted: 1 } })
  await scheduleRecompute('candidate', item.targetId)
  return { link: `${config.clientOrigin}/candidate/profile` }
}

/** The decision email to the job's company owner or the candidate, worded for a job or a profile in their language. */
async function emailOwner(item, type, { reason = '', link, photoRemoved = false }) {
  const owner = item.ownerId && (await User.findById(item.ownerId))
  if (!owner) return
  const { language } = owner
  const content = item.targetType === 'job' ? 'job' : 'profile'
  const params = {
    name: owner.fullName,
    summary: interpolate(t(language, `email.moderationSummary.${type}.${content}`), { title: item.targetName ?? '' }),
    reason,
    photoNote: photoRemoved ? t(language, 'email.moderationSummary.photoRemoved') : '',
    link,
  }
  await sendEmail({ type, to: owner.email, userId: owner._id, language, params })
}

/** POST …/content/:id/decision (M-167, OQ-1, P10-Q12). */
export async function decide(admin, id, { action, reason, removePhoto: removePhotoToo }) {
  const item = await ModerationCase.findById(id)
  if (!item) throw new AppError('NOT_FOUND')
  if (!actionsOf(item).includes(action)) throw new AppError('CONFLICT', { params: { status: item.status } })
  if (action === 'restrict' && !reason) throw fieldError({ reason: 'required' })
  const at = new Date()
  const lifting = item.status === 'restricted'
  let step = { action: lifting ? 'lifted' : action === 'restrict' ? 'restricted' : 'dismissed', reason: reason || undefined, by: admin._id, byName: admin.fullName, at }

  if (action === 'restrict') {
    const { link, photoRemoved } = await restrictTarget(item, admin, reason, removePhotoToo)
    step = { ...step, photoRemoved }
    await emailOwner(item, 'content_restricted', { reason, link, photoRemoved })
  } else if (lifting) {
    const { link } = await liftTarget(item)
    await emailOwner(item, 'content_restriction_lifted', { link })
  }
  item.status = action === 'restrict' ? 'restricted' : 'dismissed'
  item.decision = { action: item.status, reason: reason || undefined, by: admin._id, at }
  item.history.push(step)
  await item.save()
  await recordAudit({
    type: `moderation.content_${step.action}`,
    category: 'moderation',
    actor: actorFor(admin),
    target: { type: item.targetType, id: item.targetId },
    params: { name: item.targetName ?? '', targetType: item.targetType, note: reason || '' },
  })
  return caseDetail(admin, id)
}
