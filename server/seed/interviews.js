import { Application, PipelineStage } from '../modules/applications/applications.model.js'
import { Company } from '../modules/companies/companies.model.js'
import { RecruiterActivity } from '../modules/discovery/discovery.model.js'
import { DocumentRequest, Interview } from '../modules/interviews/interviews.model.js'
import { scheduleBooking, scheduleExpiry } from '../modules/interviews/interviews.service.js'
import { Job } from '../modules/jobs/jobs.model.js'
import { Conversation, Message } from '../modules/messages/messages.model.js'
import { User } from '../modules/users/users.model.js'
import { CANDIDATES } from './data/candidates.js'

/*
 * P11d-Q25, Q30: Sarah ↔ Emma, a confirmed video interview two days ahead (booked three days ago, so Emma's application
 * moved to Interview then, Q13) and an open document request; Sarah ↔ Oliver, a pending offer of two slots with AI
 * notes. Dates follow the seed run. The event lines join the two seeded threads as read (no bell); the reminders,
 * the close and the expiry are scheduled as a real booking or offer would be.
 */
const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

/** `days` from the seed run at `hour`:00 UTC. */
const atHour = (now, days, hour) => {
  const date = new Date(now + days * DAY_MS)
  date.setUTCHours(hour, 0, 0, 0)
  return date
}

async function addEvents(conversation, events) {
  await Message.insertMany(
    events.map(({ sender, at, ...event }) => ({ conversationId: conversation._id, senderId: sender._id, senderRole: sender.role, readAt: at, createdAt: at, updatedAt: at, ...event })),
    { timestamps: false },
  )
  const last = events.at(-1)
  await Conversation.updateOne({ _id: conversation._id }, { $set: { lastMessageAt: last.at, lastMessagePreview: '', lastMessageCard: `${last.kind}.${last.event}` } }, { timestamps: false })
}

export async function seedInterviews({ emailOf, now }) {
  const sarah = await User.findOne({ email: emailOf({ tag: 'sarah' }) })
  const company = await Company.findOne({ ownerUserId: sarah._id })
  const personOf = (fullName) => User.findOne({ email: emailOf(CANDIDATES.find((item) => item.fullName === fullName)) })
  const [emma, oliver] = await Promise.all([personOf('Emma Wilson'), personOf('Oliver Park')])
  const threadOf = (candidate) => Conversation.findOne({ companyId: company._id, candidateId: candidate._id })
  const applicationOf = (candidate) => Application.findOne({ companyId: company._id, candidateId: candidate._id })
  const at = (daysAgo) => new Date(now - daysAgo * DAY_MS)

  // Emma: offered 3.2 days ago, booked 3 days ago for 10:00 UTC two days ahead (45 minutes).
  const [emmaApplication, emmaThread] = await Promise.all([applicationOf(emma), threadOf(emma)])
  const startAt = atHour(now, 2, 10)
  const booking = await Interview.create({
    companyId: company._id,
    candidateId: emma._id,
    applicationId: emmaApplication._id,
    jobId: emmaApplication.jobId,
    conversationId: emmaThread._id,
    createdBy: sarah._id,
    status: 'confirmed',
    mode: 'video',
    slots: [0, 1, 2].map((day) => ({ startAt: new Date(startAt.getTime() + day * DAY_MS), minutes: 45 })),
    startAt,
    minutes: 45,
    confirmedAt: at(3),
  })
  const interviewStage = await PipelineStage.findOne({ companyId: company._id, category: 'interview' }).sort({ order: 1 })
  emmaApplication.history.push({ status: 'interview', stageId: interviewStage._id, stageName: interviewStage.name, category: 'interview', at: at(3), actorId: sarah._id, actorType: 'recruiter' })
  Object.assign(emmaApplication, { stageId: interviewStage._id, status: 'interview', lastEmailedStatus: 'interview' })
  await emmaApplication.save()
  const job = await Job.findById(emmaApplication.jobId, 'title')
  const jobParams = { jobId: String(job._id), jobTitle: job.title }
  await RecruiterActivity.insertMany([
    { companyId: company._id, candidateId: emma._id, actorId: sarah._id, type: 'stage_changed', params: { ...jobParams, stage: interviewStage.name }, at: at(3) },
    { companyId: company._id, candidateId: emma._id, type: 'interview_confirmed', params: { ...jobParams, startAt }, at: at(3) },
    { companyId: company._id, candidateId: emma._id, actorId: sarah._id, type: 'document_request', params: { ...jobParams, count: 2 }, at: at(2) },
  ])
  await scheduleBooking(booking, new Date(now))

  // Emma: an open request for her identity document and right to work, two days ago.
  const request = await DocumentRequest.create({
    companyId: company._id,
    candidateId: emma._id,
    applicationId: emmaApplication._id,
    jobId: emmaApplication.jobId,
    conversationId: emmaThread._id,
    requestedBy: sarah._id,
    items: [{ kind: 'id' }, { kind: 'right_to_work' }],
    note: 'Please share these before your interview.',
  })
  await addEvents(emmaThread, [
    { sender: sarah, at: at(3.2), kind: 'interview', event: 'offered', interviewId: booking._id },
    { sender: emma, at: at(3), kind: 'interview', event: 'confirmed', params: { startAt, minutes: 45 }, interviewId: booking._id },
    { sender: sarah, at: at(2), kind: 'document_request', event: 'created', documentRequestId: request._id },
  ])

  // Oliver: a pending offer from yesterday, two 30-minute video slots at 14:00 UTC, three and four days ahead, with AI notes.
  const [oliverApplication, oliverThread] = await Promise.all([applicationOf(oliver), threadOf(oliver)])
  const offer = await Interview.create({
    companyId: company._id,
    candidateId: oliver._id,
    applicationId: oliverApplication._id,
    jobId: oliverApplication.jobId,
    conversationId: oliverThread._id,
    createdBy: sarah._id,
    status: 'offered',
    mode: 'video',
    aiNotes: true,
    slots: [3, 4].map((days) => ({ startAt: atHour(now, days, 14), minutes: 30 })),
  })
  await scheduleExpiry(offer)
  await addEvents(oliverThread, [{ sender: sarah, at: at(1), kind: 'interview', event: 'offered', interviewId: offer._id }])
}
