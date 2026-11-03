import { config } from '../../config/env.js'
import { LIMITS } from '../../config/limits.js'
import { ScheduledTask } from '../../jobs/models.js'
import { scheduleTask, taskHandlers } from '../../jobs/scheduler.js'
import { sendEmail } from '../../lib/mailer.js'
import { Company } from '../companies/companies.model.js'
import { User } from '../users/users.model.js'
import { Conversation, Message } from './messages.model.js'

/*
 * The new-message email (M-089, U13): sent once a message has been unread for 15 minutes, and at most once per
 * thread and recipient side every 60 minutes, in the recipient's language. One pending task per thread and side.
 */
const { unreadDelayMs, perConversationMs } = LIMITS.messageEmail
const emailKey = (conversationId, side) => `email.message:${conversationId}:${side}`
const sender = (side) => (side === 'candidate' ? 'recruiter' : 'candidate')

const dueAt = (conversation, side, unreadSince) =>
  new Date(Math.max(unreadSince.getTime() + unreadDelayMs, (conversation.lastEmailAt?.[side]?.getTime() ?? 0) + perConversationMs))

/** A message to `side` was sent at `sentAt`: a pending email for that side already covers it. */
export async function scheduleMessageEmail(conversation, side, sentAt) {
  const key = emailKey(conversation._id, side)
  if (await ScheduledTask.exists({ key, status: 'pending' })) return
  await scheduleTask({ type: 'email.message', key, dueAt: dueAt(conversation, side, sentAt), payload: { conversationId: String(conversation._id), side } })
}

async function sendMessageEmail(payload, task, now) {
  const { conversationId, side } = payload
  const conversation = await Conversation.findById(conversationId)
  const oldestUnread = conversation && (await Message.findOne({ conversationId, senderRole: sender(side), readAt: null }, 'createdAt').sort({ createdAt: 1 }))
  if (!oldestUnread) return
  // Read and answered meanwhile, or emailed within the hour: wait for the oldest unread message's own 15 minutes.
  const due = dueAt(conversation, side, oldestUnread.createdAt)
  if (due > now) {
    await scheduleTask({ type: 'email.message', key: task.key, dueAt: due, payload })
    return
  }
  const [recipient, company, candidate] = await Promise.all([
    side === 'candidate' ? User.findById(conversation.candidateId) : User.findOne({ companyId: conversation.companyId, role: 'recruiter', status: 'active' }),
    Company.findById(conversation.companyId, 'displayName'),
    User.findById(conversation.candidateId, 'fullName'),
  ])
  if (!recipient) return
  await sendEmail({
    type: 'new_message',
    to: recipient.email,
    userId: recipient._id,
    language: recipient.language,
    params: {
      name: recipient.fullName,
      sender: side === 'candidate' ? company.displayName : candidate.fullName,
      link: `${config.clientOrigin}/${side}/messages/${conversationId}`,
    },
  })
  await Conversation.updateOne({ _id: conversation._id }, { [`lastEmailAt.${side}`]: now }, { timestamps: false })
}

taskHandlers['email.message'] = sendMessageEmail
