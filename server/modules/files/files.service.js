import { AppError } from '../../lib/errors.js'
import { signedUrl } from '../../lib/files.js'
import { File } from './files.model.js'

// §2.6: KYC, evidence, right-to-work, certificate and voice-note files need `documents.view`.
const SENSITIVE_PURPOSES = ['evidence', 'kyc', 'certificate_file', 'report_voice']

/** GET /admin/files/:fileId: a signed URL for an admin reviewing a sensitive file (M-186). */
export async function adminFileUrl(admin, fileId) {
  const file = await File.findOne({ _id: fileId, purpose: { $in: SENSITIVE_PURPOSES } })
  if (!file) throw new AppError('NOT_FOUND')
  return { url: signedUrl(file, admin._id), name: file.originalName, mime: file.mime }
}
