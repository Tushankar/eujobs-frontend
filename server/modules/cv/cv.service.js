import { LIMITS } from '../../config/limits.js'
import { AppError, fieldError } from '../../lib/errors.js'
import { removeFiles, signedUrl, storeFile } from '../../lib/files.js'
import { extractText } from '../../lib/pdfText.js'
import { loadProfile, saveProfile } from '../candidates/candidates.service.js'
import { Company } from '../companies/companies.model.js'
import { recordActivity, recordCvUpdated } from '../discovery/discovery.service.js'
import { File, FileAccessLog } from '../files/files.model.js'
import { CvAccessRequest, CvVersion } from './cv.model.js'

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
  if (String(profile.liveCvVersionId) === String(id)) return
  profile.liveCvVersionId = id
  await saveProfile(user, profile)
  // M-081: companies following this candidate see "CV updated" (P4-D13).
  await recordCvUpdated(user._id, (await CvVersion.findById(id, 'number')).number)
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

/* ---------- earlier-version requests and the download log (M-029, M-187, U19, P4-D12) ---------- */

const companyNames = async (ids) => new Map((await Company.find({ _id: { $in: ids } }, 'displayName')).map((company) => [String(company._id), company.displayName]))

/** GET /candidate/cv/requests: pending first, then decided, newest first. */
export async function listRequests(user) {
  const requests = await CvAccessRequest.find({ candidateId: user._id }).sort({ createdAt: -1 })
  const names = await companyNames(requests.map((request) => request.companyId))
  const versions = new Map((await CvVersion.find({ _id: { $in: requests.map((request) => request.cvVersionId).filter(Boolean) } }, 'number')).map((version) => [String(version._id), version.number]))
  const items = requests
    .map((request) => ({
      id: String(request._id),
      company: { displayName: names.get(String(request.companyId)) ?? null },
      reason: request.reason,
      details: request.details ?? '',
      status: request.status,
      createdAt: request.createdAt,
      decidedAt: request.decidedAt ?? null,
      versionNumber: request.cvVersionId ? versions.get(String(request.cvVersionId)) ?? null : null,
    }))
    .sort((a, b) => Number(b.status === 'pending') - Number(a.status === 'pending'))
  return { items, total: items.length, page: 1, pageSize: items.length }
}

/** Approve by choosing which version to share (A: recruiter RQ-44), or decline; nothing else is shared. */
export async function decideRequest(user, id, { decision, versionId }) {
  const request = await CvAccessRequest.findOne({ _id: id, candidateId: user._id })
  if (!request) throw new AppError('NOT_FOUND')
  if (request.status !== 'pending') throw new AppError('CONFLICT', { params: { status: request.status } })
  let version
  if (decision === 'approved') {
    if (!versionId) throw fieldError({ versionId: 'required' })
    version = await ownVersion(user, versionId)
  }
  request.set({ status: decision, cvVersionId: version?._id, decidedAt: new Date() })
  await request.save()
  await recordActivity({ companyId: request.companyId, candidateId: user._id, type: 'cv_request_decided', params: { decision, version: version?.number } })
}

/** GET /candidate/cv/downloads: every view of the candidate's CV files by a company (M-187). */
export async function listDownloads(user) {
  const logs = await FileAccessLog.find({ ownerId: user._id, companyId: { $ne: null } }).sort({ at: -1 })
  const names = await companyNames(logs.map((log) => log.companyId))
  const versions = new Map((await CvVersion.find({ userId: user._id, fileId: { $in: logs.map((log) => log.fileId) } }, 'fileId number originalName')).map((version) => [String(version.fileId), version]))
  const items = logs.map((log) => {
    const version = versions.get(String(log.fileId))
    return {
      id: String(log._id),
      company: { displayName: names.get(String(log.companyId)) ?? null },
      version: version ? { number: version.number, originalName: version.originalName } : null,
      at: log.at,
    }
  })
  return { items, total: items.length, page: 1, pageSize: items.length }
}
