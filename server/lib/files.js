import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { mkdir, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileTypeFromBuffer } from 'file-type'
import { config } from '../config/env.js'
import { LIMITS } from '../config/limits.js'
import { File } from '../modules/files/files.model.js'
import { AppError } from './errors.js'

/*
 * File storage and signed URLs (§2.6, M-185, U39). Files live under the upload root in one folder per
 * purpose with random names; they are served only through GET /files/:id with a signed, expiring URL.
 */
export const MIME = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
}
const EXTENSION_ALIASES = { jpeg: 'jpg' }

const extensionOf = (name = '') => {
  const ext = name.includes('.') ? name.slice(name.lastIndexOf('.') + 1).toLowerCase() : ''
  return EXTENSION_ALIASES[ext] ?? ext
}

/**
 * M-185: the name's extension, the declared MIME and the magic bytes must all name the same allowed type.
 * Returns that extension, or throws FILE_TYPE_NOT_ALLOWED.
 */
export async function detectFileType({ originalname, mimetype, buffer }, allowed) {
  const detected = await fileTypeFromBuffer(buffer)
  const ext = extensionOf(originalname)
  const declaredOk = mimetype === MIME[ext] || mimetype === 'application/octet-stream'
  if (!detected || !allowed.includes(ext) || detected.ext !== ext || !declaredOk) {
    throw new AppError('FILE_TYPE_NOT_ALLOWED', { params: { types: allowed } })
  }
  return ext
}

export const absolutePath = (file) => join(config.uploadRoot, file.path)

/** Writes the bytes under a random name and records the File. */
export async function storeFile({ ownerId, purpose, buffer, ext, originalName, deleteAfter }) {
  const path = `${purpose}/${randomBytes(16).toString('hex')}.${ext}`
  await mkdir(join(config.uploadRoot, purpose), { recursive: true })
  await writeFile(join(config.uploadRoot, path), buffer)
  const sha256 = createHash('sha256').update(buffer).digest('hex')
  return File.create({ ownerId, purpose, path, originalName, mime: MIME[ext], size: buffer.length, sha256, deleteAfter })
}

/**
 * Deletes the files from disk and their records; missing ids and files are ignored. A file another
 * request is still streaming (Windows: EBUSY) is logged and left behind rather than failing this request.
 */
export async function removeFiles(ids) {
  const files = await File.find({ _id: { $in: ids.filter(Boolean) } })
  for (const file of files) {
    await unlink(absolutePath(file)).catch((error) => {
      if (error.code !== 'ENOENT') console.error(`File ${file._id} could not be deleted from disk: ${error.code}`)
    })
  }
  await File.deleteMany({ _id: { $in: files.map((file) => file._id) } })
}

const signature = (file, userId, exp) => createHmac('sha256', config.fileUrlSecret).update(`${file.path}|${userId}|${exp}`).digest('hex')

// The expiry is rounded down to 5-minute steps, so a refreshed DTO repeats the same URL and the browser does not
// load the same file again (an avatar would otherwise reload on every /me response).
const URL_STEP_SECONDS = 5 * 60

/** U39: a URL for `userId`, valid 10 to 15 minutes. Issue it only after the ownership or visibility check. */
export function signedUrl(file, userId, { download = false } = {}) {
  const exp = Math.floor((Date.now() + LIMITS.signedUrlTtlMs) / 1000 / URL_STEP_SECONDS) * URL_STEP_SECONDS
  const query = new URLSearchParams({ u: String(userId), exp: String(exp), sig: signature(file, userId, exp) })
  if (download) query.set('download', '1')
  return `/api/v1/files/${file._id}?${query}`
}

/** True when `sig` was issued for this file, user and expiry, and the expiry has not passed. */
export function validSignature(file, { u, exp, sig }) {
  const expected = Buffer.from(signature(file, u, exp))
  const given = Buffer.from(sig)
  return given.length === expected.length && timingSafeEqual(given, expected) && exp * 1000 > Date.now()
}
