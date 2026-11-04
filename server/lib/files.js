import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { mkdir, open, rename, stat, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileTypeFromBuffer } from 'file-type'
import { config } from '../config/env.js'
import { LIMITS } from '../config/limits.js'
import { File } from '../modules/files/files.model.js'
import { AppError } from './errors.js'
import { looksLikeSvg } from './svg.js'

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
  svg: 'image/svg+xml',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  csv: 'text/csv',
}
const EXTENSION_ALIASES = { jpeg: 'jpg' }
// Browsers declare audio files under several names (M-182); file-type names Ogg Opus "opus".
const DECLARED_ALIASES = {
  mp3: ['audio/mp3'],
  m4a: ['audio/x-m4a', 'audio/m4a'],
  wav: ['audio/x-wav', 'audio/wave', 'audio/vnd.wave'],
  webm: ['audio/webm'],
  ogg: ['video/ogg', 'application/ogg'],
}
const DETECTED_ALIASES = { opus: 'ogg', oga: 'ogg' }

const extensionOf = (name = '') => {
  const ext = name.includes('.') ? name.slice(name.lastIndexOf('.') + 1).toLowerCase() : ''
  return EXTENSION_ALIASES[ext] ?? ext
}

/**
 * M-185: the name's extension, the declared MIME and the magic bytes must all name the same allowed type.
 * Returns that extension, or throws FILE_TYPE_NOT_ALLOWED.
 */
export async function detectFileType({ originalname, mimetype, buffer }, allowed) {
  const ext = extensionOf(originalname)
  // SVG is text, so magic bytes cannot name it; its start is checked instead (M-150).
  const detected = ext === 'svg' ? (looksLikeSvg(buffer) ? { ext } : undefined) : await fileTypeFromBuffer(buffer)
  const declaredOk = mimetype === MIME[ext] || DECLARED_ALIASES[ext]?.includes(mimetype) || mimetype === 'application/octet-stream'
  if (!detected || !allowed.includes(ext) || (DETECTED_ALIASES[detected.ext] ?? detected.ext) !== ext || !declaredOk) {
    throw new AppError('FILE_TYPE_NOT_ALLOWED', { params: { types: allowed } })
  }
  return ext
}

export const absolutePath = (file) => join(config.uploadRoot, file.path)

/** Large uploads (video, lesson PDFs) are streamed here by multer, then moved into their purpose folder. */
export const incomingDir = () => join(config.uploadRoot, '_incoming')

/** The first bytes of a file on disk, enough for the magic-byte check. */
export async function readHead(path, length = 4100) {
  const handle = await open(path)
  try {
    const { buffer, bytesRead } = await handle.read(Buffer.alloc(length), 0, length, 0)
    return buffer.subarray(0, bytesRead)
  } finally {
    await handle.close()
  }
}

const sha256Of = (path) =>
  new Promise((resolve, reject) => {
    const hash = createHash('sha256')
    createReadStream(path).on('error', reject).on('data', (chunk) => hash.update(chunk)).on('end', () => resolve(hash.digest('hex')))
  })

/** Writes the bytes (or moves the uploaded file at `tempPath`) under a random name and records the File. */
export async function storeFile({ ownerId, purpose, buffer, tempPath, ext, originalName, deleteAfter }) {
  const path = `${purpose}/${randomBytes(16).toString('hex')}.${ext}`
  await mkdir(join(config.uploadRoot, purpose), { recursive: true })
  if (tempPath) {
    const [sha256, { size }] = await Promise.all([sha256Of(tempPath), stat(tempPath)])
    await rename(tempPath, join(config.uploadRoot, path))
    return File.create({ ownerId, purpose, path, originalName, mime: MIME[ext], size, sha256, deleteAfter })
  }
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

/**
 * U39: a URL for `userId`, valid 10 to 15 minutes (video: `ttlMs` of 6 hours, less up to 5 minutes). Issue it only
 * after the ownership or visibility check.
 */
export function signedUrl(file, userId, { download = false, ttlMs = LIMITS.signedUrlTtlMs } = {}) {
  const exp = Math.floor((Date.now() + ttlMs) / 1000 / URL_STEP_SECONDS) * URL_STEP_SECONDS
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
