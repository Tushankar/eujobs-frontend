import { ZipArchive } from 'archiver'
import PDFDocument from 'pdfkit'
import sharp from 'sharp'

/*
 * Test files built in memory (P11): the API tests use them directly, and e2e/fixtures/make.js writes
 * them to disk for the browser checks.
 */
function collect(stream) {
  return new Promise((resolve, reject) => {
    const chunks = []
    stream.on('data', (chunk) => chunks.push(chunk))
    stream.on('end', () => resolve(Buffer.concat(chunks)))
    stream.on('error', reject)
  })
}

/**
 * A plain image of one colour, e.g. image('png'), image('jpeg'), image('webp'), image('gif'). `noise` fills it
 * with random pixels instead, so it hardly compresses (for real files of a given size).
 */
export function image(format, { width = 64, height = 64, background = '#3a6ea5', noise = false } = {}) {
  const create = { width, height, channels: 3, ...(noise ? { noise: { type: 'gaussian', mean: 128, sigma: 60 } } : { background }) }
  return sharp({ create }).toFormat(format).toBuffer()
}

/** A PDF with a text layer. */
export function textPdf(lines) {
  const doc = new PDFDocument()
  const done = collect(doc)
  for (const line of [lines].flat()) doc.fontSize(12).text(line)
  doc.end()
  return done
}

/** A PDF holding only an image, so it has no readable text (U18). */
export async function imagePdf() {
  const png = await image('png', { width: 600, height: 300 })
  const doc = new PDFDocument()
  const done = collect(doc)
  doc.image(png, 50, 50, { width: 400 })
  doc.end()
  return done
}

const escapeXml = (text) => text.replace(/[<>&]/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[char])

/** A minimal Word document (OOXML zipped with archiver). */
export function docx(text) {
  const archive = new ZipArchive()
  const done = collect(archive)
  archive.append(
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    { name: '[Content_Types].xml' },
  )
  archive.append(
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    { name: '_rels/.rels' },
  )
  archive.append(
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${escapeXml(text)}</w:t></w:r></w:p></w:body></w:document>`,
    { name: 'word/document.xml' },
  )
  archive.finalize()
  return done
}

/** The start of a Windows executable, to be uploaded under an image name. */
export const executable = () => Buffer.concat([Buffer.from('MZ'), Buffer.alloc(510)])

/** `size` bytes that begin like `head` (size limits are checked before the type). */
export const padded = (head, size) => Buffer.concat([head, Buffer.alloc(size - head.length)])

export const MB = 1024 * 1024
