import { LIMITS } from '../../config/limits.js'
import { AppError, fieldError } from '../../lib/errors.js'
import { signedUrl } from '../../lib/files.js'
import { skillOverlap } from '../../lib/skills.js'
import { Application } from '../applications/applications.model.js'
import { CandidateProfile } from '../candidates/candidates.model.js'
import { jobFacts, write } from '../ai/ai.facts.js'
import { PROMPTS } from '../ai/ai.prompts.js'
import { Company } from '../companies/companies.model.js'
import { logoUrls } from '../companies/companies.service.js'
import { accessibleCandidate, recordActivity } from '../discovery/discovery.service.js'
import { File } from '../files/files.model.js'
import { cardsFor } from '../interviews/interviews.cards.js'
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
    lastMessageCard: conversation.lastMessageCard ?? null,
    unread: conversation.unread[user.role],
    // The other side deleted their account (P12-Q2, M-189): no more replies.
    closed: Boolean(conversation.closedAt),
  }))
}

const messageDto = (message, side) => ({
  id: String(message._id),
  mine: message.senderRole === side,
  senderRole: message.senderRole,
  kind: message.kind ?? 'text',
  body: message.body ?? '',
  // §3.23: an interview or document-request event and its card.
  ...(message.kind && message.kind !== 'text' && {
    event: message.event,
    params: message.params ?? {},
    cardId: String(message.interviewId ?? message.documentRequestId),
  }),
  createdAt: message.createdAt,
  readAt: message.readAt ?? null,
})

/** Typed messages: everything that is not an interview or document-request event (older rows have no kind). */
const TEXT_ONLY = { kind: { $nin: ['interview', 'document_request'] } }

export async function listConversations(user, company) {
  const conversations = await Conversation.find({ ...ownFilter(user, company), lastMessageAt: { $ne: null } }).sort({ lastMessageAt: -1 })
  const items = await conversationDtos(user, conversations)
  return { items, total: items.length, page: 1, pageSize: items.length }
}

/** The thread and every message, oldest first (threads are short; §2.3 all rows), with the live interview and request cards (§3.23). */
export async function getMessages(user, company, id) {
  const conversation = await ownConversation(user, company, id)
  const messages = await Message.find({ conversationId: conversation._id }).sort({ createdAt: 1 })
  const [dto] = await conversationDtos(user, [conversation])
  return { conversation: dto, items: messages.map((message) => messageDto(message, user.role)), cards: await cardsFor(user, conversation) }
}

/**
 * The job the thread is about: its own job, else the candidate's latest active application to the company, else
 * (`inferred`, a recruiter wrote about "a role" without picking one) the company's open job sharing the most skills
 * with the candidate, newest first on a tie; null when the company has none open.
 */
async function threadJob(conversation, profile) {
  if (conversation.jobId) return { job: await Job.findById(conversation.jobId), inferred: false }
  const application = await Application.findOne({ candidateId: conversation.candidateId, companyId: conversation.companyId, status: { $ne: 'withdrawn' } }, 'jobId').sort({ createdAt: -1 })
  if (application) return { job: await Job.findById(application.jobId), inferred: false }
  const open = await Job.find({ companyId: conversation.companyId, status: 'published' }).sort({ publishedAt: -1 }).limit(LIMITS.message.replySuggestions.openRoles)
  const fit = (job) => skillOverlap(profile?.skills ?? [], job).matched.length
  const best = open.reduce((top, job) => (!top || fit(job) > fit(top) ? job : top), null)
  return { job: best, inferred: true, openRoles: open.map((job) => job.title) }
}

/** The candidate as both sides of the thread may know them: what Find candidates and the profile show, no salary or CV. */
function candidateBrief(user, profile) {
  return {
    name: user.fullName,
    headline: profile?.headline ?? '',
    yearsExperience: profile?.yearsExperience ?? null,
    skills: (profile?.skills ?? []).map((skill) => skill.standard || skill.name),
    availability: profile?.availability ?? null,
    workPreference: profile?.workPreference ?? null,
    city: profile?.location?.city ?? null,
    languages: (profile?.languages ?? []).map(({ code, level }) => `${code} ${level}`),
    recentRoles: (profile?.workHistory ?? []).slice(0, 2).map(({ title, employer }) => [title, employer].filter(Boolean).join(' at ')),
  }
}

/**
 * The facts a suggested reply may use (few tokens): the job (brief and responsibilities cut short; `inferred` when the
 * thread names none, with the company's open roles), the company and the candidate.
 */
async function replyContext(conversation) {
  const R = LIMITS.message.replySuggestions
  const [company, candidate, profile] = await Promise.all([
    Company.findById(conversation.companyId, 'displayName industry size location'),
    User.findById(conversation.candidateId, 'fullName'),
    CandidateProfile.findOne({ userId: conversation.candidateId }),
  ])
  const { job, inferred, openRoles = [] } = await threadJob(conversation, profile)
  const facts = job && (await jobFacts(job))
  return {
    job: facts && { ...facts, brief: facts.brief.slice(0, R.briefChars), responsibilities: facts.responsibilities.slice(0, R.responsibilities), inferred },
    openRoles,
    company: company && { name: company.displayName, industry: company.industry ?? null, size: company.size ?? null, city: company.location?.city ?? null },
    candidate: candidate && candidateBrief(candidate, profile),
  }
}

/**
 * GET /conversations/:id/reply-suggestions: three replies to the latest message when it is the other side's, from the
 * last few messages and the facts of the job, company and candidate (few tokens), cached per message, facts and
 * language, so reopening the thread costs nothing.
 */
export async function replySuggestions(user, company, id) {
  const conversation = await ownConversation(user, company, id)
  const R = LIMITS.message.replySuggestions
  const latest = (await Message.find({ conversationId: conversation._id, ...TEXT_ONLY }).sort({ createdAt: -1 }).limit(R.messages)).reverse()
  const last = latest.at(-1)
  if (conversation.closedAt || !last || last.senderRole === user.role) return { messageId: last ? String(last._id) : null, replies: [] }
  const input = {
    you: user.role === 'candidate' ? 'the candidate' : 'a recruiter at the company',
    ...(await replyContext(conversation)),
    messages: latest.map((message) => ({ from: message.senderRole === user.role ? 'you' : 'them', text: message.body.slice(0, R.chars) })),
  }
  const { replies } = await write(PROMPTS.replySuggestions, { user, input, subjectId: conversation.candidateId })
  return { messageId: String(last._id), replies: replies.map((reply) => reply.trim()).filter(Boolean).slice(0, R.count) }
}

/** Adds a message: the other side's unread count, its delayed email (U13) and, for a candidate's answer, a `message_reply` event. */
async function addMessage(conversation, user, body) {
  if (conversation.closedAt) throw new AppError('CONFLICT', { params: { reason: 'conversation_closed' } })
  const side = user.role
  const previous = await Message.findOne({ conversationId: conversation._id, ...TEXT_ONLY }, 'senderRole').sort({ createdAt: -1 })
  const message = await Message.create({ conversationId: conversation._id, senderId: user._id, senderRole: side, body })
  await Conversation.updateOne(
    { _id: conversation._id },
    { $set: { lastMessageAt: message.createdAt, lastMessagePreview: body.slice(0, PREVIEW_LENGTH), lastMessageCard: null }, $inc: { [`unread.${otherSide(side)}`]: 1 } },
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

/**
 * §3.23: an interview or document-request event in the thread, written by the side that acted. It counts as unread for
 * the other side; its own notification and email replace the new-message ones.
 */
export async function addEvent(conversation, user, { kind, event, params = {}, interviewId, documentRequestId }) {
  const message = await Message.create({ conversationId: conversation._id, senderId: user._id, senderRole: user.role, kind, event, params, interviewId, documentRequestId })
  await Conversation.updateOne(
    { _id: conversation._id },
    { $set: { lastMessageAt: message.createdAt, lastMessagePreview: '', lastMessageCard: `${kind}.${event}` }, $inc: { [`unread.${otherSide(user.role)}`]: 1 } },
  )
  return message
}

/** The thread of this pair, created on first use; `created` tells whether it is new. */
export async function threadFor({ companyId, candidateId, jobId, startedBy }) {
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
