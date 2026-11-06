import { DateTime } from 'luxon'
import { LIMITS } from '../../config/limits.js'
import { dailyJobs } from '../../jobs/scheduler.js'
import { removeFiles } from '../../lib/files.js'
import { Application } from '../applications/applications.model.js'
import { KycDocument } from '../companies/companies.model.js'
import { File } from '../files/files.model.js'
import { DocumentRequest, Interview } from '../interviews/interviews.model.js'
import { Notification } from '../notifications/notifications.model.js'
import { VerificationSubmission } from '../verification/verification.model.js'

/*
 * The daily retention sweep at 03:00 server time (M-186, U32, C18, P11b-Q5). Identity, KYC and evidence files are
 * deleted once their `deleteAfter` (30 days after the decision, set when it is taken) has passed; the decision records
 * stay. Certificate files are exempt. Notifications older than 90 days go too (the TTL index does the same; the sweep
 * makes it happen at a known time).
 */
const EXEMPT = ['certificate_file', 'certificate_pdf']
const DAY_MS = 24 * 60 * 60 * 1000

export async function retentionSweep(now = new Date()) {
  const due = await File.find({ deleteAfter: { $lte: now }, purpose: { $nin: EXEMPT } }, '_id')
  const ids = due.map((file) => file._id)
  await removeFiles(ids)
  await VerificationSubmission.updateMany({ fileId: { $in: ids } }, { $set: { fileId: null } })
  await KycDocument.updateMany({ fileId: { $in: ids } }, { $set: { fileId: null } })
  const { deletedCount } = await Notification.deleteMany({ at: { $lt: new Date(now.getTime() - LIMITS.notifications.retentionDays * DAY_MS) } })
  return { files: ids.length, notifications: deletedCount, ...(await purgeInterviewData(now)) }
}

/** When an application closed (hired, not selected or withdrawn), or null while it is open. */
function closedAt(application) {
  if (application.status === 'withdrawn') return application.withdrawnAt
  if (application.status === 'not_selected') return application.notSelectedAt
  if (application.status === 'hired') return application.history.findLast((entry) => entry.status === 'hired')?.at ?? null
  return null
}

/**
 * P11d-Q8: 6 months after the application closed, interview notes, transcripts, any leftover audio and both sides'
 * request files are deleted; the interview records, outcomes and feedback notes stay.
 */
export async function purgeInterviewData(now = new Date()) {
  const cutoff = DateTime.fromJSDate(now).minus({ months: LIMITS.interviews.retentionMonths }).toJSDate()
  const open = { purgedAt: null }
  const applicationIds = [...new Set([...(await Interview.distinct('applicationId', open)), ...(await DocumentRequest.distinct('applicationId', open))].map(String))]
  const closed = (await Application.find({ _id: { $in: applicationIds }, status: { $in: ['hired', 'not_selected', 'withdrawn'] } })).filter((application) => closedAt(application) && closedAt(application) <= cutoff)
  const ids = closed.map((application) => application._id)
  if (!ids.length) return { interviews: 0, documentRequests: 0 }
  const interviews = await Interview.find({ applicationId: { $in: ids }, ...open })
  const requests = await DocumentRequest.find({ applicationId: { $in: ids }, ...open })
  await removeFiles([...interviews.map((interview) => interview.recording?.fileId), ...requests.flatMap((request) => [request.attachmentFileId, ...request.items.map((item) => item.fileId)])])
  await Interview.updateMany({ _id: { $in: interviews.map((interview) => interview._id) } }, { $set: { purgedAt: now, 'recording.fileId': null }, $unset: { notes: 1, transcript: 1 } })
  await DocumentRequest.updateMany({ _id: { $in: requests.map((request) => request._id) } }, { $set: { purgedAt: now }, $unset: { attachmentFileId: 1, 'items.$[].fileId': 1 } })
  return { interviews: interviews.length, documentRequests: requests.length }
}

dailyJobs.push({ name: 'retention-sweep', hour: 3, run: retentionSweep })
