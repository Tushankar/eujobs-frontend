import { randomInt } from 'node:crypto'
import { config } from '../../config/env.js'
import { actorFor, recordAudit } from '../../lib/audit.js'
import { AppError } from '../../lib/errors.js'
import { removeFiles, signedUrl, storeFile } from '../../lib/files.js'
import { sendEmail } from '../../lib/mailer.js'
import { certificatePdf } from '../../lib/pdf.js'
import { File } from '../files/files.model.js'
import { User } from '../users/users.model.js'
import { Certificate } from './learning.model.js'

/*
 * Certificates (M-105, U17, C18): issued once, when the final quiz is first passed; the PDF is a stored snapshot in
 * the holder's language, re-issued under the same code when the holder's name changes. The public check answers
 * Valid, Revoked or No longer valid. Certificate files are exempt from retention (C18). Badges show wherever the
 * profile is visible (C24); certificates do not verify skills (M-026).
 */
// No 0/O or 1/I, so a code read from paper is not ambiguous (P8-C7).
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
const block = () => Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('')
const newCode = () => `LWM-${block()}-${block()}`

export const verifyUrl = (code) => `${config.clientOrigin}/certificates/${code}`

async function storePdf(certificate, user) {
  const buffer = await certificatePdf({
    holderName: certificate.holderName,
    courseTitle: certificate.courseTitle,
    issuedAt: certificate.issuedAt,
    code: certificate.code,
    language: certificate.language,
    timeZone: user.timezone,
    verifyUrl: verifyUrl(certificate.code),
  })
  return storeFile({ ownerId: user._id, purpose: 'certificate_pdf', buffer, ext: 'pdf', originalName: `${certificate.code}.pdf` })
}

/** Issues the certificate of a passed course, stores its PDF and sends `certificate_issued` (a decision email). */
export async function issueCertificate(user, course) {
  let certificate
  for (let attempt = 0; !certificate; attempt++) {
    try {
      certificate = await Certificate.create({ code: newCode(), userId: user._id, courseId: course._id, holderName: user.fullName, courseTitle: course.title, language: user.language, issuedAt: new Date() })
    } catch (error) {
      // A code collision (unique index) draws a new code.
      if (error.code !== 11000 || attempt >= 4) throw error
    }
  }
  certificate.pdfFileId = (await storePdf(certificate, user))._id
  await certificate.save()
  await sendEmail({
    type: 'certificate_issued',
    to: user.email,
    userId: user._id,
    language: user.language,
    params: { name: user.fullName, course: course.title, code: certificate.code, link: `${config.clientOrigin}/${user.role}/learning/${course._id}`, secondaryLink: verifyUrl(certificate.code) },
  })
  return certificate
}

/** U17: after a name change, every valid certificate gets a new PDF with the new name and the same code. */
export async function reissueCertificates(user) {
  for (const certificate of await Certificate.find({ userId: user._id, status: 'valid' })) {
    const previous = certificate.pdfFileId
    certificate.holderName = user.fullName
    certificate.language = user.language
    certificate.pdfFileId = (await storePdf(certificate, user))._id
    await certificate.save()
    await removeFiles([previous])
  }
}

export function certificateDto(certificate) {
  return {
    id: String(certificate._id),
    code: certificate.code,
    courseId: String(certificate.courseId),
    courseTitle: certificate.courseTitle,
    holderName: certificate.holderName,
    issuedAt: certificate.issuedAt,
    status: certificate.status,
    verifyUrl: verifyUrl(certificate.code),
  }
}

/** GET /learning/certificates: the user's own certificates, newest first. */
export async function listOwnCertificates(user) {
  const items = (await Certificate.find({ userId: user._id }).sort({ issuedAt: -1 })).map(certificateDto)
  return { items, total: items.length, page: 1, pageSize: items.length }
}

/** GET /learning/certificates/:id/pdf: a signed download link to the stored snapshot. */
export async function ownCertificatePdf(user, id) {
  const certificate = await Certificate.findOne({ _id: id, userId: user._id })
  const file = certificate && (await File.findById(certificate.pdfFileId))
  if (!file) throw new AppError('NOT_FOUND')
  return { url: signedUrl(file, user._id, { download: true }) }
}

/** GET /public/certificates/:code (U17, C18): a tombstone shows only its code and "No longer valid". */
export async function publicCertificate(code) {
  const certificate = await Certificate.findOne({ code: code.toUpperCase() })
  if (!certificate) throw new AppError('NOT_FOUND')
  if (certificate.status === 'no_longer_valid') return { code: certificate.code, status: certificate.status }
  return { code: certificate.code, status: certificate.status, holderName: certificate.holderName, courseTitle: certificate.courseTitle, issuedAt: certificate.issuedAt, revokedAt: certificate.revokedAt ?? null }
}

/** POST /admin/certificates/:id/revoke (M-105): audited; the public check then answers Revoked. */
export async function revokeCertificate(admin, id, { reason }) {
  const certificate = await Certificate.findById(id)
  if (!certificate) throw new AppError('NOT_FOUND')
  if (certificate.status !== 'valid') throw new AppError('CONFLICT')
  Object.assign(certificate, { status: 'revoked', revokedAt: new Date(), revokedBy: admin._id, revokeReason: reason })
  await certificate.save()
  const holder = await User.findById(certificate.userId, 'fullName')
  await recordAudit({
    type: 'learning.certificate_revoked',
    category: 'learning',
    actor: actorFor(admin),
    target: { type: 'certificate', id: certificate._id },
    params: { code: certificate.code, title: certificate.courseTitle, name: holder?.fullName ?? certificate.holderName, reason },
  })
  return certificateDto(certificate)
}

/** C24: the valid certificates of each user, for the profile views that may show them. */
export async function badgesOf(userIds) {
  const certificates = await Certificate.find({ userId: { $in: userIds }, status: 'valid' }).sort({ issuedAt: -1 })
  const byUser = new Map()
  for (const certificate of certificates) {
    const key = String(certificate.userId)
    byUser.set(key, [...(byUser.get(key) ?? []), { code: certificate.code, courseTitle: certificate.courseTitle, issuedAt: certificate.issuedAt, verifyUrl: verifyUrl(certificate.code) }])
  }
  return (userId) => byUser.get(String(userId)) ?? []
}

/** The certificate of each enrollment (learners list, course details). */
export async function certificatesById(ids) {
  return new Map((await Certificate.find({ _id: { $in: ids.filter(Boolean) } })).map((certificate) => [String(certificate._id), certificate]))
}
