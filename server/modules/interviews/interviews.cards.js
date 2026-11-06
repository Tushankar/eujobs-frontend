import { LIMITS } from '../../config/limits.js'
import { signedUrl } from '../../lib/files.js'
import { ACTIVE_FILTER, Application } from '../applications/applications.model.js'
import { File } from '../files/files.model.js'
import { Job } from '../jobs/jobs.model.js'
import { User } from '../users/users.model.js'
import { DocumentRequest, Interview } from './interviews.model.js'

/*
 * What each side sees of an interview or a document request (§3.23). The candidate's phone shows to the recruiter only
 * on a confirmed Phone interview (P11d-Q23); the outcome, the feedback note and whether notes exist only to the company;
 * files only through signed URLs issued to the reader (P11d-Q7).
 */
const L = LIMITS.interviews

/** The join window of a confirmed interview (P11d-Q2, Q26). */
export function joinWindow(interview) {
  if (!interview.startAt) return null
  const start = interview.startAt.getTime()
  return { opensAt: new Date(start - L.joinEarlyMs), closesAt: new Date(start + interview.minutes * 60_000 + L.joinLateMs) }
}

const sideOf = (user) => (user.role === 'candidate' ? 'candidate' : 'recruiter')
const other = (side) => (side === 'candidate' ? 'recruiter' : 'candidate')

export function interviewDto(user, interview, { jobTitle, phone } = {}) {
  const side = sideOf(user)
  const recruiter = side === 'recruiter'
  const window = joinWindow(interview)
  return {
    id: String(interview._id),
    status: interview.status,
    mode: interview.mode,
    address: interview.address ?? null,
    link: interview.link ?? null,
    aiNotes: interview.aiNotes,
    slots: interview.slots.map(({ startAt, minutes }) => ({ startAt, minutes })),
    startAt: interview.startAt ?? null,
    minutes: interview.minutes ?? null,
    joinOpensAt: window?.opensAt ?? null,
    joinClosesAt: window?.closesAt ?? null,
    otherTimesNote: interview.otherTimesNote ?? null,
    rescheduleRequest: interview.rescheduleRequest?.at ? { note: interview.rescheduleRequest.note ?? '', at: interview.rescheduleRequest.at } : null,
    cancelReason: interview.cancelReason ?? null,
    applicationId: String(interview.applicationId),
    conversationId: String(interview.conversationId),
    job: { id: String(interview.jobId), title: jobTitle ?? null },
    consent: { mine: interview.consent?.[side] ?? null, other: interview.consent?.[other(side)] ?? null },
    recording: { status: interview.recording?.status ?? 'off' },
    ...(recruiter && {
      phone: interview.mode === 'phone' && interview.status === 'confirmed' ? (phone ?? null) : null,
      outcome: interview.outcome?.result ? { result: interview.outcome.result, note: interview.outcome.note ?? '', at: interview.outcome.at } : null,
      hasNotes: Boolean(interview.notes?.generatedAt) && !interview.purgedAt,
    }),
  }
}

/** DTOs for several interviews, with job titles and (recruiter, phone interviews) the candidate's verified phone. */
export async function interviewDtos(user, interviews) {
  const [jobs, phones] = await Promise.all([
    Job.find({ _id: { $in: interviews.map((interview) => interview.jobId) } }, 'title'),
    user.role === 'recruiter' ? User.find({ _id: { $in: interviews.filter((interview) => interview.mode === 'phone').map((interview) => interview.candidateId) } }, 'phone') : [],
  ])
  const titles = new Map(jobs.map((job) => [String(job._id), job.title]))
  const phoneOf = new Map(phones.map((candidate) => [String(candidate._id), candidate.phone?.verifiedAt ? candidate.phone.e164 : null]))
  return interviews.map((interview) => interviewDto(user, interview, { jobTitle: titles.get(String(interview.jobId)), phone: phoneOf.get(String(interview.candidateId)) }))
}

const fileDto = (file, user) => (file ? { name: file.originalName ?? null, size: file.size, url: signedUrl(file, user._id) } : null)

export async function documentRequestDtos(user, requests) {
  const ids = requests.flatMap((request) => [request.attachmentFileId, ...request.items.map((item) => item.fileId)]).filter(Boolean)
  const [files, jobs] = await Promise.all([File.find({ _id: { $in: ids } }), Job.find({ _id: { $in: requests.map((request) => request.jobId) } }, 'title')])
  const fileById = new Map(files.map((file) => [String(file._id), file]))
  const titles = new Map(jobs.map((job) => [String(job._id), job.title]))
  const fileOf = (id) => fileDto(id && fileById.get(String(id)), user)
  return requests.map((request) => ({
    id: String(request._id),
    status: request.status,
    note: request.note ?? '',
    applicationId: String(request.applicationId),
    conversationId: String(request.conversationId),
    job: { id: String(request.jobId), title: titles.get(String(request.jobId)) ?? null },
    attachment: fileOf(request.attachmentFileId),
    removed: Boolean(request.purgedAt),
    items: request.items.map((item) => ({
      id: String(item._id),
      kind: item.kind,
      label: item.label ?? null,
      file: fileOf(item.fileId),
      uploadedAt: item.uploadedAt ?? null,
      declineNote: item.declineNote ?? null,
      declinedAt: item.declinedAt ?? null,
    })),
    createdAt: request.createdAt,
    completedAt: request.completedAt ?? null,
  }))
}

/**
 * The latest interview of each application, for the pipeline and Applications rows (owner answer P11d-A6): its state,
 * booked time and outcome; `active` when it is still under way (offered, other times asked, or booked and not started).
 */
export async function latestInterviews(applicationIds, now = new Date()) {
  const interviews = await Interview.find({ applicationId: { $in: applicationIds }, status: { $ne: 'cancelled' } }, 'applicationId status startAt minutes outcome createdAt').sort({ createdAt: 1 })
  const latest = new Map(interviews.map((interview) => [String(interview.applicationId), interview]))
  return new Map(
    [...latest].map(([applicationId, interview]) => [
      applicationId,
      {
        id: String(interview._id),
        status: interview.status,
        startAt: interview.startAt ?? null,
        minutes: interview.minutes ?? null,
        outcome: interview.outcome?.result ?? null,
        active: ['offered', 'other_times'].includes(interview.status) || (interview.status === 'confirmed' && interview.startAt > now),
      },
    ]),
  )
}

/** The interviews of these applications, oldest first, per application id (the application's activity, P11d-Q16). */
export async function interviewsByApplication(user, applicationIds) {
  const dtos = await interviewDtos(user, await Interview.find({ applicationId: { $in: applicationIds } }).sort({ createdAt: 1 }))
  const byApplication = new Map()
  for (const item of dtos) byApplication.set(item.applicationId, [...(byApplication.get(item.applicationId) ?? []), item])
  return byApplication
}

/**
 * GET /conversations/:id/messages: the live cards of the thread (P11d-Q16) and, for the recruiter, the pair's active
 * applications an interview or a document request can be for (P11d-Q19).
 */
export async function cardsFor(user, conversation) {
  const [interviews, requests, applications] = await Promise.all([
    Interview.find({ conversationId: conversation._id }),
    DocumentRequest.find({ conversationId: conversation._id }),
    user.role === 'recruiter' ? Application.find({ companyId: conversation.companyId, candidateId: conversation.candidateId, ...ACTIVE_FILTER }, 'jobId').sort({ appliedAt: -1 }) : [],
  ])
  const titles = new Map((await Job.find({ _id: { $in: applications.map((application) => application.jobId) } }, 'title')).map((job) => [String(job._id), job.title]))
  return {
    interviews: await interviewDtos(user, interviews),
    documentRequests: await documentRequestDtos(user, requests),
    ...(user.role === 'recruiter' && { activeApplications: applications.map((application) => ({ id: String(application._id), job: { id: String(application.jobId), title: titles.get(String(application.jobId)) ?? null } })) }),
  }
}
