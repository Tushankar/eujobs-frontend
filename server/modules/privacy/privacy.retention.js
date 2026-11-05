import { LIMITS } from '../../config/limits.js'
import { dailyJobs } from '../../jobs/scheduler.js'
import { removeFiles } from '../../lib/files.js'
import { KycDocument } from '../companies/companies.model.js'
import { File } from '../files/files.model.js'
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
  return { files: ids.length, notifications: deletedCount }
}

dailyJobs.push({ name: 'retention-sweep', hour: 3, run: retentionSweep })
