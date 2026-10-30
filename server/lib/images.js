import sharp from 'sharp'
import { AppError } from './errors.js'

/*
 * sharp helpers (§2.6). Re-encoding drops every metadata block (EXIF, GPS, ICC comments) because
 * sharp only keeps metadata when asked to; rotate() first applies the EXIF orientation. Bytes that pass
 * the magic-byte check but cannot be decoded are refused like a wrong type.
 */
const FORMAT = { jpg: 'jpeg', png: 'png', webp: 'webp' }

async function decoded(image) {
  try {
    return await image.toBuffer()
  } catch {
    throw new AppError('FILE_TYPE_NOT_ALLOWED')
  }
}

/** The same image type, re-encoded without metadata. */
export function reencodeImage(buffer, ext) {
  return decoded(sharp(buffer).rotate().toFormat(FORMAT[ext]))
}

/** A square cover crop of `size` pixels as WebP (M-013: 400×400 and 96×96). */
export function squareWebp(buffer, size) {
  return decoded(sharp(buffer).rotate().resize(size, size, { fit: 'cover' }).webp({ quality: 85 }))
}

/** Evidence and certificate files: PDFs as uploaded, images re-encoded. */
export function sanitizedUpload({ buffer, ext }) {
  return ext === 'pdf' ? buffer : reencodeImage(buffer, ext)
}
