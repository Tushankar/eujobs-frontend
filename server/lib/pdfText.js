import mammoth from 'mammoth'
import { getDocument, VerbosityLevel } from 'pdfjs-dist/legacy/build/pdf.mjs'

/*
 * CV text extraction (M-027, U18): pdfjs-dist (legacy build, Node) for PDF, mammoth for DOCX. No OCR, so a
 * PDF without a text layer yields (almost) nothing and is flagged "No readable text" by the caller.
 * A file that passes the type checks but cannot be parsed also yields no text.
 */
const MAX_CHARS = 100_000

async function pdfText(buffer) {
  const task = getDocument({ data: new Uint8Array(buffer), isEvalSupported: false, verbosity: VerbosityLevel.ERRORS })
  try {
    const pdf = await task.promise
    const pages = []
    for (let number = 1; number <= pdf.numPages; number++) {
      const content = await (await pdf.getPage(number)).getTextContent()
      pages.push(content.items.map((item) => item.str).join(' '))
    }
    return pages.join('\n')
  } finally {
    await task.destroy()
  }
}

export async function extractText(buffer, ext) {
  try {
    const text = ext === 'docx' ? (await mammoth.extractRawText({ buffer })).value : await pdfText(buffer)
    return text.trim().slice(0, MAX_CHARS)
  } catch {
    return ''
  }
}
