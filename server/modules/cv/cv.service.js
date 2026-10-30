import { LIMITS } from '../../config/limits.js'
import { AppError, fieldError } from '../../lib/errors.js'
import { removeFiles, signedUrl, storeFile } from '../../lib/files.js'
import { extractText } from '../../lib/pdfText.js'
import { loadProfile, saveProfile } from '../candidates/candidates.service.js'
import { File } from '../files/files.model.js'
import { CvVersion } from './cv.model.js'

/* CV versions (M-027 … M-031, U18, P3-D7). A deleted version keeps its record with no file. */

const versionDto = (version, liveId) => ({
  id: String(version._id),
  number: version.number,
  originalName: version.originalName,
  mime: version.mime,
  size: version.size,
  noReadableText: version.noReadableText,
  createdAt: version.createdAt,
  live: String(version._id) === String(liveId),
})

/** GET /candidate/cv: the versions that still have a file, newest first. */
export async function listVersions(user) {
  const [profile, versions] = await Promise.all([
    loadProfile(user._id),
    CvVersion.find({ userId: user._id, fileId: { $ne: null } }, '-extractedText').sort({ number: -1 }),
  ])
  return {
    liveVersionId: profile.liveCvVersionId ? String(profile.liveCvVersionId) : null,
    items: versions.map((version) => versionDto(version, profile.liveCvVersionId)),
  }
}

/** Upload: text extracted at once; the new version becomes the live CV, as the CV page has always done. */
export async function uploadVersion(user, upload) {
  const { maxVersions, minReadableChars } = LIMITS.cv
  if ((await CvVersion.countDocuments({ userId: user._id, fileId: { $ne: null } })) >= maxVersions) {
    throw fieldError({ file: 'too_many' }, { max: maxVersions })
  }
  const text = await extractText(upload.buffer, upload.ext)
  const file = await storeFile({ ownerId: user._id, purpose: 'cv', buffer: upload.buffer, ext: upload.ext, originalName: upload.originalname })
  const last = await CvVersion.findOne({ userId: user._id }, 'number').sort({ number: -1 })
  const version = await CvVersion.create({
    userId: user._id,
    number: (last?.number ?? 0) + 1,
    fileId: file._id,
    originalName: upload.originalname,
    mime: file.mime,
    size: file.size,
    extractedText: text,
    noReadableText: text.replace(/\s/g, '').length < minReadableChars,
  })
  await setLive(user, version._id)
  return version
}

async function ownVersion(user, id) {
  const version = await CvVersion.findOne({ _id: id, userId: user._id, fileId: { $ne: null } })
  if (!version) throw new AppError('NOT_FOUND')
  return version
}

export async function setLive(user, id) {
  const profile = await loadProfile(user._id)
  profile.liveCvVersionId = id
  await saveProfile(user, profile)
}

export async function makeLive(user, id) {
  await ownVersion(user, id)
  await setLive(user, id)
}

/** M-028: any own version can be downloaded. */
export async function downloadUrl(user, id) {
  const version = await ownVersion(user, id)
  return { url: signedUrl(await File.findById(version.fileId), user._id, { download: true }) }
}

/** M-028: any version except the live one can be deleted; M-030: the file goes everywhere. */
export async function deleteVersion(user, id) {
  const version = await ownVersion(user, id)
  const profile = await loadProfile(user._id)
  if (String(profile.liveCvVersionId) === String(version._id)) throw new AppError('CONFLICT', { params: { reason: 'live' } })
  const fileId = version.fileId
  version.fileId = null
  await version.save()
  await removeFiles([fileId])
}
