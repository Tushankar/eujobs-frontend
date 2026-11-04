import { NOTIFICATION_TYPES } from '../config/enums.js'
import { effectivePermissions } from '../modules/admin/admin.service.js'
import { Company } from '../modules/companies/companies.model.js'
import { Conversation, Message } from '../modules/messages/messages.model.js'
import { ModerationCase } from '../modules/moderation/moderation.model.js'
import { Notification } from '../modules/notifications/notifications.model.js'
import { User } from '../modules/users/users.model.js'

/*
 * P11b-Q13: one notification per seeded event that is still waiting, dated like the event, read from the seeded data:
 * unread messages (one per conversation and side, with the count), open content cases and recruiter accounts pending
 * review (for every admin holding the type's permission). Nothing else is invented.
 */
const row = (user, type, fields) => ({ userId: user._id, type, section: NOTIFICATION_TYPES[type].sections[user.role] ?? null, readAt: null, ...fields })

async function messageRows() {
  const rows = []
  for (const conversation of await Conversation.find({ $or: [{ 'unread.candidate': { $gt: 0 } }, { 'unread.recruiter': { $gt: 0 } }] })) {
    const company = await Company.findById(conversation.companyId, 'displayName')
    for (const side of ['candidate', 'recruiter']) {
      const count = conversation.unread[side]
      if (!count) continue
      const recipient = side === 'candidate' ? await User.findById(conversation.candidateId) : await User.findOne({ companyId: conversation.companyId, role: 'recruiter', status: 'active' })
      const latest = await Message.findOne({ conversationId: conversation._id, senderRole: { $ne: side }, readAt: null }).sort({ createdAt: -1 })
      if (!recipient || !latest) continue
      const sender = side === 'candidate' ? company.displayName : (await User.findById(conversation.candidateId, 'fullName')).fullName
      rows.push(row(recipient, 'message', { params: { sender }, target: { kind: 'conversation', id: String(conversation._id) }, groupKey: `conversation:${conversation._id}`, count, at: latest.createdAt }))
    }
  }
  return rows
}

async function adminRows() {
  const events = []
  for (const item of await ModerationCase.find({ status: 'open', openedBy: 'user' })) {
    const latest = item.reports.at(-1)
    events.push({
      type: 'admin_content_report',
      params: { name: item.targetName, targetType: item.targetType, reason: latest.reason },
      target: { kind: 'case', id: String(item._id) },
      groupKey: `case:${item._id}`,
      count: item.reports.length,
      at: latest.at,
    })
  }
  for (const recruiter of await User.find({ role: 'recruiter', status: 'pending_review' })) {
    const company = await Company.findOne({ ownerUserId: recruiter._id }, 'legalName submittedAt')
    events.push({
      type: 'admin_account_review',
      params: { name: recruiter.fullName, company: company.legalName, resubmitted: false },
      target: { kind: 'account', id: String(recruiter._id) },
      at: company.submittedAt,
    })
  }
  const rows = []
  for (const admin of await User.find({ role: 'admin', status: 'active' })) {
    const permissions = await effectivePermissions(admin)
    for (const event of events) {
      const { permission } = NOTIFICATION_TYPES[event.type]
      if (permissions.has(permission)) rows.push(row(admin, event.type, { ...event, permission }))
    }
  }
  return rows
}

export async function seedNotifications() {
  await Notification.insertMany([...(await messageRows()), ...(await adminRows())])
}
