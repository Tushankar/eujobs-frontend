import { JobAlert } from '../modules/alerts/alerts.model.js'
import { Company } from '../modules/companies/companies.model.js'
import { RecruiterActivity } from '../modules/discovery/discovery.model.js'
import { Job } from '../modules/jobs/jobs.model.js'
import { Conversation, Message } from '../modules/messages/messages.model.js'
import { User } from '../modules/users/users.model.js'
import { CANDIDATES } from './data/candidates.js'
import { ALERTS, THREADS } from './data/messages.js'

/* Threads with their outreach and reply events, and job alerts, for seed:demo (P7-Q3, P7-Q4). */
const DAY_MS = 24 * 60 * 60 * 1000

export async function seedMessages({ emailOf, now }) {
  const candidateOf = (fullName) => User.findOne({ email: emailOf(CANDIDATES.find((item) => item.fullName === fullName)) })
  const sarah = await User.findOne({ email: emailOf({ tag: 'sarah' }) })
  const company = await Company.findOne({ ownerUserId: sarah._id })

  for (const { person, job: title, messages } of THREADS) {
    const candidate = await candidateOf(person)
    const job = await Job.findOne({ companyId: company._id, title })
    const at = (daysAgo) => new Date(now - daysAgo * DAY_MS)
    const last = messages.at(-1)
    const unread = (side) => messages.filter((message) => message.from !== side && !message.read).length
    const conversation = await Conversation.create({
      companyId: company._id,
      candidateId: candidate._id,
      jobId: job._id,
      startedBy: messages[0].from,
      lastMessageAt: at(last.daysAgo),
      lastMessagePreview: last.body.slice(0, 140),
      unread: { candidate: unread('candidate'), recruiter: unread('recruiter') },
    })
    await Message.insertMany(
      messages.map((message) => ({
        conversationId: conversation._id,
        senderId: message.from === 'recruiter' ? sarah._id : candidate._id,
        senderRole: message.from,
        body: message.body,
        readAt: message.read ? at(message.daysAgo) : undefined,
        createdAt: at(message.daysAgo),
        updatedAt: at(message.daysAgo),
      })),
      { timestamps: false },
    )
    const jobParams = { jobId: String(job._id), jobTitle: job.title }
    await RecruiterActivity.insertMany(
      messages.flatMap((message, index) => {
        if (index === 0 && message.from === 'recruiter') return [{ companyId: company._id, candidateId: candidate._id, actorId: sarah._id, type: 'outreach', params: jobParams, at: at(message.daysAgo) }]
        if (message.from === 'candidate' && messages[index - 1]?.from === 'recruiter') return [{ companyId: company._id, candidateId: candidate._id, type: 'message_reply', params: {}, at: at(message.daysAgo) }]
        return []
      }),
    )
  }

  for (const { person, ...alert } of ALERTS) {
    const candidate = await candidateOf(person)
    await JobAlert.create({ ...alert, candidateId: candidate._id, language: candidate.language, location: null })
  }
}
