import { AppError, fieldError } from '../../lib/errors.js'
import { signedUrl } from '../../lib/files.js'
import { Application } from '../applications/applications.model.js'
import { CandidateProfile } from '../candidates/candidates.model.js'
import { Company } from '../companies/companies.model.js'
import { logoUrls } from '../companies/companies.service.js'
import { accessibleCandidate, recordActivity } from '../discovery/discovery.service.js'
import { File } from '../files/files.model.js'
import { Job } from '../jobs/jobs.model.js'
import { markSeen, notify, notifyCompany } from '../notifications/notifications.service.js'
import { User } from '../users/users.model.js'
import { scheduleMessageEmail } from './messages.emails.js'
import { Conversation, Message } from './messages.model.js'

/*
 * Two-way messages (§3.5): one thread per company and candidate (M-086). A paid candidate starts only with a company
 * they applied to (M-084); an approved recruiter starts only with applicants and candidates they can discover
 * (M-085, U28); a withdrawn application does not count for either. An existing thread stays open for both sides. Free candidates read only (the route checks
 * `message_send`). Recruiters never see a candidate's plan (M-087). The side of a user is their role.
 */
const PREVIEW_LENGTH = 140

export const otherSide = (side) => (side === 'candidate' ? 'recruiter' : 'candidate')
const ownFilter = (user, company) => (user.role === 'candidate' ? { candidateId: user._id } : { companyId: company._id })

async function ownConversation(user, company, id) {
  const conversation = await Conversation.findOne({ _id: id, ...ownFilter(user, company) })
  if (!conversation) throw new AppError('NOT_FOUND')
  return conversation
}

/** The other party of each thread: the company for candidates; the candidate's name, headline and photo for recruiters. */
async function counterparts(user, conversations) {
  if (user.role === 'candidate') {
    const companies = await Company.find({ _id: { $in: conversations.map((conversation) => conversation.companyId) } }, 'displayName logoFileId')
    const logos = await logoUrls(companies, user._id)
    return new Map(companies.map((company) => [String(company._id), { id: String(company._id), name: company.displayName, imageUrl: logos.get(String(company._id)) ?? null }]))
  }
  const ids = conversations.map((conversation) => conversation.candidateId)
  const [users, profiles] = await Promise.all([User.find({ _id: { $in: ids } }, 'fullName'), CandidateProfile.find({ userId: { $in: ids } }, 'userId headline photo')])
  const photos = new Map((await File.find({ _id: { $in: profiles.map((profile) => profile.photo?.fileId).filter(Boolean) } })).map((file) => [String(file._id), file]))
  const profileOf = new Map(profiles.map((profile) => [String(profile.userId), profile]))
  return new Map(
    users.map((candidate) => {
      const profile = profileOf.get(String(candidate._id))
      const photo = profile?.photo?.fileId && photos.get(String(profile.photo.fileId))
      return [String(candidate._id), { id: String(candidate._id), name: candidate.fullName, headline: profile?.headline ?? '', imageUrl: photo ? signedUrl(photo, user._id) : null }]
    }),
  )
}

async function conversationDtos(user, conversations) {
  const [parties, jobs] = await Promise.all([
    counterparts(user, conversations),
    Job.find({ _id: { $in: conversations.map((conversation) => conversation.jobId).filter(Boolean) } }, 'title'),
  ])
  const jobTitles = new Map(jobs.map((job) => [String(job._id), job.title]))
  return conversations.map((conversation) => ({
    id: String(conversation._id),
    counterpart: parties.get(String(user.role === 'candidate' ? conversation.companyId : conversation.candidateId)) ?? null,
    job: conversation.jobId ? { id: String(conversation.jobId), title: jobTitles.get(String(conversation.jobId)) ?? null } : null,
    lastMessageAt: conversation.lastMessageAt ?? null,
    lastMessagePreview: conversation.lastMessagePreview ?? '',
    unread: conversation.unread[user.role],
  }))
}

const messageDto = (message, side) => ({
  id: String(message._id),
  mine: message.senderRole === side,
  senderRole: message.senderRole,
  body: message.body,
  createdAt: message.createdAt,
  readAt: message.readAt ?? null,
})

export async function listConversations(user, company) {
  const conversations = await Conversation.find({ ...ownFilter(user, company), lastMessageAt: { $ne: null } }).sort({ lastMessageAt: -1 })
  const items = await conversationDtos(user, conversations)
  return { items, total: items.length, page: 1, pageSize: items.length }
}

/** The thread and every message, oldest first (threads are short; §2.3 all rows). */
export async function getMessages(user, company, id) {
  const conversation = await ownConversation(user, company, id)
  const messages = await Message.find({ conversationId: conversation._id }).sort({ createdAt: 1 })
  const [dto] = await conversationDtos(user, [conversation])
  return { conversation: dto, items: messages.map((message) => messageDto(message, user.role)) }
}

/** Adds a message: the other side's unread count, its delayed email (U13) and, for a candidate's answer, a `message_reply` event. */
async function addMessage(conversation, user, body) {
  const side = user.role
  const previous = await Message.findOne({ conversationId: conversation._id }, 'senderRole').sort({ createdAt: -1 })
  const message = await Message.create({ conversationId: conversation._id, senderId: user._id, senderRole: side, body })
  await Conversation.updateOne(
    { _id: conversation._id },
    { $set: { lastMessageAt: message.createdAt, lastMessagePreview: body.slice(0, PREVIEW_LENGTH) }, $inc: { [`unread.${otherSide(side)}`]: 1 } },
  )
  if (side === 'candidate' && previous?.senderRole === 'recruiter') {
    await recordActivity({ companyId: conversation.companyId, candidateId: user._id, type: 'message_reply', params: {} })
  }
  await scheduleMessageEmail(conversation, otherSide(side), message.createdAt)
  await notifyMessage(conversation, user)
  return message
}

/** P11b-Q6: one unread notification per conversation for the other side, with the sender and how many messages. */
async function notifyMessage(conversation, user) {
  const options = { target: { kind: 'conversation', id: conversation._id }, groupKey: `conversation:${conversation._id}` }
  if (user.role === 'candidate') {
    await notifyCompany(conversation.companyId, 'message', { ...options, params: { sender: user.fullName } })
    return
  }
  const [candidate, company] = await Promise.all([User.findById(conversation.candidateId), Company.findById(conversation.companyId, 'displayName')])
  if (candidate) await notify(candidate, 'message', { ...options, params: { sender: company.displayName } })
}

/** The thread of this pair, created on first use; `created` tells whether it is new. */
async function threadFor({ companyId, candidateId, jobId, startedBy }) {
  const existing = await Conversation.findOne({ companyId, candidateId })
  if (existing) return { conversation: existing, created: false }
  try {
    return { conversation: await Conversation.create({ companyId, candidateId, jobId, startedBy }), created: true }
  } catch (error) {
    if (error.code !== 11000) throw error
    return { conversation: await Conversation.findOne({ companyId, candidateId }), created: false }
  }
}

/** POST /conversations: starts the thread, or adds to the existing one of the same pair (M-086). */
export async function start(user, company, { candidateId, jobId, body }) {
  let thread
  if (user.role === 'candidate') {
    if (!jobId) throw fieldError({ jobId: 'required' })
    const job = await Job.findById(jobId, 'companyId')
    if (!job) throw new AppError('NOT_FOUND')
    // M-084: a new thread needs an application to the company that is not withdrawn; an existing thread stays open.
    const allowed =
      (await Conversation.exists({ companyId: job.companyId, candidateId: user._id })) ||
      (await Application.exists({ candidateId: user._id, companyId: job.companyId, status: { $ne: 'withdrawn' } }))
    if (!allowed) throw new AppError('FORBIDDEN')
    thread = await threadFor({ companyId: job.companyId, candidateId: user._id, jobId: job._id, startedBy: 'candidate' })
  } else {
    if (!candidateId) throw fieldError({ candidateId: 'required' })
    const job = jobId && (await Job.findOne({ _id: jobId, companyId: company._id }, 'title'))
    if (jobId && !job) throw fieldError({ jobId: 'invalid' })
    // M-085, U28: a new thread only with an applicant (not withdrawn) or a candidate listable now; an existing one stays open.
    if (!(await Conversation.exists({ companyId: company._id, candidateId }))) {
      await accessibleCandidate(candidateId, company, { status: { $ne: 'withdrawn' } }).catch(() => {
        throw new AppError('FORBIDDEN')
      })
    }
    thread = await threadFor({ companyId: company._id, candidateId, jobId: job?._id, startedBy: 'recruiter' })
    // M-180: each recruiter-started conversation is one reviewed outreach.
    if (thread.created) await recordActivity({ companyId: company._id, candidateId, actorId: user._id, type: 'outreach', params: job ? { jobId: String(job._id), jobTitle: job.title } : {} })
  }
  const message = await addMessage(thread.conversation, user, body)
  const [dto] = await conversationDtos(user, [await Conversation.findById(thread.conversation._id)])
  return { conversation: dto, message: messageDto(message, user.role) }
}

export async function send(user, company, id, body) {
  const message = await addMessage(await ownConversation(user, company, id), user, body)
  return messageDto(message, user.role)
}

/** Marks the other side's messages read and clears this side's unread count. */
export async function markRead(user, company, id) {
  const conversation = await ownConversation(user, company, id)
  await Message.updateMany({ conversationId: conversation._id, senderRole: otherSide(user.role), readAt: null }, { readAt: new Date() })
  await Conversation.updateOne({ _id: conversation._id }, { [`unread.${user.role}`]: 0 }, { timestamps: false })
  // P11b-Q10: reading the conversation clears its notification too.
  await markSeen(user, { kind: 'conversation', id: conversation._id })
}

/** M-094: unread messages across this user's threads (the candidate's own, or every thread of the recruiter's company). */
export async function unreadCount(user, companyId) {
  const filter = user.role === 'candidate' ? { candidateId: user._id } : { companyId }
  const [result] = await Conversation.aggregate([{ $match: filter }, { $group: { _id: null, total: { $sum: `$unread.${user.role}` } } }])
  return result?.total ?? 0
}
