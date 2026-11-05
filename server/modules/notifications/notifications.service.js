import { EMAIL_CATEGORIES, NOTIFICATION_TYPES } from '../../config/enums.js'
import { sendEmail } from '../../lib/mailer.js'
import { effectivePermissions } from '../admin/admin.service.js'
import { Application } from '../applications/applications.model.js'
import { accessibleCandidate } from '../discovery/discovery.service.js'
import { Job } from '../jobs/jobs.model.js'
import { jobDetails } from '../jobs/jobs.search.js'
import { Enrollment } from '../learning/learning.model.js'
import { Conversation, Message } from '../messages/messages.model.js'
import { ModerationCase } from '../moderation/moderation.model.js'
import { Payment } from '../payments/payments.model.js'
import { User } from '../users/users.model.js'
import { VerificationSubmission } from '../verification/verification.model.js'
import { Notification } from './notifications.model.js'

/*
 * In-app notifications (Phase 11b, P11b-Q1 … Q15). Each one is visible to its own user only; an admin sees an admin
 * type only while holding its permission. Opening one checks that its item still exists and is open to the reader,
 * then marks it read; opening the item itself (from anywhere) marks its notifications read too (P11b-Q10).
 */

/** Pages that are the item themselves (CV requests, Verification, Billing, …), per role. */
const PAGE_PATHS = {
  cv_requests: () => '/candidate/cv-versions',
  verification: () => '/candidate/verification',
  profile: () => '/candidate/profile',
  billing: (role) => `/${role}/settings/billing`,
  overview: () => '/recruiter',
  review: () => '/recruiter/onboarding/review',
}

/** Where each target opens (P11b-Q1, Q9). */
const PATHS = {
  page: (role, id) => PAGE_PATHS[id](role),
  application: (role, id) => `/${role}/applications/${id}`,
  conversation: (role, id) => `/${role}/messages/${id}`,
  job: (role, id) => `/${role}/jobs/${id}`,
  course: (role, id) => `/${role}/learning/${id}`,
  candidate: (role, id) => `/recruiter/find-candidates/${id}`,
  account: (role, id) => `/admin/moderation/accounts/${id}`,
  submission: (role, id) => `/admin/moderation/verification/${id}`,
  case: (role, id) => `/admin/moderation/content/${id}`,
  payment: (role, id) => `/admin/payments/${id}`,
  admin: (role, id) => `/admin/access-management/users/${id}`,
}

const own = (user) => (user.role === 'candidate' ? { candidateId: user._id } : { companyId: user.companyId })

/** Whether the target still exists and is open to this reader (P11b-Q4: otherwise "no longer available"). */
const AVAILABLE = {
  page: async () => true,
  application: (user, id) => Application.exists({ _id: id, ...own(user) }),
  // A thread emptied by the candidate's erasure (P12-Q2) is no longer available.
  conversation: async (user, id) => (await Conversation.exists({ _id: id, ...own(user) })) && Message.exists({ conversationId: id }),
  job: (user, id) => (user.role === 'candidate' ? jobDetails(user, id) : Job.exists({ _id: id, companyId: user.companyId })),
  course: (user, id) => Enrollment.exists({ userId: user._id, courseId: id }),
  candidate: (user, id) => accessibleCandidate(id, { _id: user.companyId }),
  account: (user, id) => User.exists({ _id: id, role: 'recruiter' }),
  submission: (user, id) => VerificationSubmission.exists({ _id: id }),
  case: (user, id) => ModerationCase.exists({ _id: id }),
  payment: (user, id) => Payment.exists({ _id: id }),
  admin: (user, id) => User.exists({ _id: id, role: 'admin' }),
}

async function isAvailable(user, target) {
  try {
    return Boolean(await AVAILABLE[target.kind](user, target.id))
  } catch {
    return false
  }
}

/**
 * Records one event for `user` (a user document). With `groupKey`, an unread notification of the same key is
 * updated instead: its parameters and time become the latest, and its count grows (P11b-Q6).
 */
export async function notify(user, type, { params = {}, target, groupKey, permission, at = new Date() }) {
  const fields = { type, params, target: { kind: target.kind, id: String(target.id) }, section: NOTIFICATION_TYPES[type].sections[user.role] ?? null, permission, at }
  if (!groupKey) return Notification.create({ userId: user._id, ...fields })
  return Notification.findOneAndUpdate(
    { userId: user._id, groupKey, readAt: null },
    { $set: fields, $inc: { count: 1 } },
    { upsert: true, returnDocument: 'after' },
  )
}

/** The company's recruiter (the account the company's emails go to), or null. */
export function companyRecruiter(companyId) {
  return User.findOne({ companyId, role: 'recruiter', status: 'active' })
}

/** Notifies the company's recruiter, if there is one. */
export async function notifyCompany(companyId, type, options) {
  const recruiter = await companyRecruiter(companyId)
  if (recruiter) await notify(recruiter, type, options)
}

/**
 * An admin event (P11b-Q1, Q4, Q12): every active admin holding the type's permission (owners hold all) gets the
 * notification and, at once, its email in their language (non-critical: their category switch and the cap apply).
 * `emailParams(language)` gives the email's parameters; `exclude` leaves one admin out (the one the event is about).
 */
export async function notifyAdmins(type, { params, target, groupKey, emailParams, exclude }) {
  const { permission, email } = NOTIFICATION_TYPES[type]
  for (const admin of await User.find({ role: 'admin', status: 'active', ...(exclude && { _id: { $ne: exclude } }) })) {
    if (!(await effectivePermissions(admin)).has(permission)) continue
    await notify(admin, type, { params, target, groupKey, permission })
    await sendEmail({ type: email, to: admin.email, userId: admin._id, language: admin.language, params: { name: admin.fullName, ...emailParams(admin.language) } })
  }
}

/** The reader's own notifications; for an admin only the types whose permission they still hold. */
async function scope(user) {
  if (user.role !== 'admin') return { userId: user._id }
  return { userId: user._id, permission: { $in: [...(await effectivePermissions(user))] } }
}

const dto = (user, item) => ({
  id: String(item._id),
  type: item.type,
  params: item.params ?? {},
  count: item.count,
  at: item.at,
  read: Boolean(item.readAt),
  path: PATHS[item.target.kind](user.role, item.target.id),
})

/** GET /notifications: newest first; `filter=unread` lists unread ones only. */
export async function list(user, { filter, page, pageSize }) {
  const base = await scope(user)
  const query = filter === 'unread' ? { ...base, readAt: null } : base
  const [items, total, unread] = await Promise.all([
    Notification.find(query).sort({ at: -1, _id: -1 }).skip((page - 1) * pageSize).limit(pageSize),
    Notification.countDocuments(query),
    Notification.countDocuments({ ...base, readAt: null }),
  ])
  return { items: items.map((item) => dto(user, item)), total, page, pageSize, unread }
}

/** The bell and sidebar numbers (P11b-Q2, Q10), part of GET /me/counters. */
export async function counts(user) {
  const sections = await Notification.aggregate([{ $match: { ...(await scope(user)), readAt: null } }, { $group: { _id: '$section', count: { $sum: 1 } } }])
  return {
    unread: sections.reduce((sum, entry) => sum + entry.count, 0),
    sections: Object.fromEntries(sections.filter((entry) => entry._id).map((entry) => [entry._id, entry.count])),
  }
}

/** Marks every unread notification about this target read (the item was opened, from anywhere). */
export async function markSeen(user, target) {
  await Notification.updateMany({ userId: user._id, 'target.kind': target.kind, 'target.id': String(target.id), readAt: null }, { readAt: new Date() })
}

/** POST /notifications/:id/open: marks it (and its item's other notifications) read; the path, or "no longer available". */
export async function open(user, id) {
  const item = await Notification.findOne({ _id: id, ...(await scope(user)) })
  if (!item) return { available: false }
  await markSeen(user, item.target)
  if (!(await isAvailable(user, item.target))) return { available: false }
  return { available: true, path: dto(user, item).path }
}

export async function readAll(user) {
  await Notification.updateMany({ ...(await scope(user)), readAt: null }, { readAt: new Date() })
}

/** PATCH /me/notifications: the categories of this role that are switched off (P11b-Q3, Q12). */
export async function setEmailSwitches(user, switches) {
  const categories = EMAIL_CATEGORIES[user.role]
  user.emailOff = categories.filter((category) => switches[category] === false || (switches[category] === undefined && user.emailOff?.includes(category)))
  await user.save()
}

/** The switches of this role, each on unless switched off. */
export const emailSwitches = (user) => Object.fromEntries(EMAIL_CATEGORIES[user.role].map((category) => [category, !user.emailOff?.includes(category)]))

/**
 * Once, at startup: the former single email toggle (`notifyEmail`) is copied into every category of the account's
 * role (P11b-Q12), then removed. The native driver is used because the field is no longer in the schema.
 */
export async function migrateEmailToggle() {
  for (const [role, categories] of Object.entries(EMAIL_CATEGORIES)) {
    await User.collection.updateMany({ role, notifyEmail: false }, { $set: { emailOff: categories } })
  }
  await User.collection.updateMany({ notifyEmail: { $exists: true } }, { $unset: { notifyEmail: '' } })
}
