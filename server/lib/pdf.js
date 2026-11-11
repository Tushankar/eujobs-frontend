import { fileURLToPath } from 'node:url'
import PDFDocument from 'pdfkit'
import QRCode from 'qrcode'
import { interpolate, t } from './i18n.js'

/*
 * The certificate PDF (M-105, U17, P8-Q3): A4 landscape with the embedded Inter fonts (Latin Extended), the chrome in
 * the holder's language, the holder's name and the course title as authored, the issue date in the holder's format
 * (OQ-6b regions), the code and a vector QR code with the link to the public check.
 */
const font = (weight) => fileURLToPath(new URL(`../assets/fonts/Inter-${weight}.ttf`, import.meta.url))
const LOGO = fileURLToPath(new URL('../assets/logo.png', import.meta.url))
const LOCALE = { en: 'en-IE', es: 'es-ES', fr: 'fr-FR' }
// The brand never changes with the language (M-193).
const BRAND = 'EU Jobs'
const COLOURS = { ink: '#202534', muted: '#687184', primary: '#0066C4', border: '#E8EAF0' }

/** The QR code's dark modules as filled squares, `size` points wide, at (x, y). */
function drawQr(doc, text, x, y, size) {
  const { modules } = QRCode.create(text, { errorCorrectionLevel: 'M' })
  const cell = size / modules.size
  doc.save().fillColor(COLOURS.ink)
  for (let row = 0; row < modules.size; row++) {
    for (let column = 0; column < modules.size; column++) {
      if (modules.get(row, column)) doc.rect(x + column * cell, y + row * cell, cell, cell)
    }
  }
  doc.fill().restore()
}

/** Resolves with the PDF bytes. */
export function certificatePdf({ holderName, courseTitle, issuedAt, code, language, timeZone, verifyUrl }) {
  const text = (key, params) => interpolate(t(language, `certificate.${key}`), params)
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 0, info: { Title: `${text('title')} · ${courseTitle}`, Author: BRAND } })
  for (const weight of ['Regular', 'SemiBold', 'Bold']) doc.registerFont(weight, font(weight))
  const chunks = []
  const done = new Promise((resolve, reject) => doc.on('data', (chunk) => chunks.push(chunk)).on('end', () => resolve(Buffer.concat(chunks))).on('error', reject))

  const { width, height } = doc.page
  const inner = { x: 48, y: 48, width: width - 96, height: height - 96 }
  doc.rect(24, 24, width - 48, height - 48).lineWidth(1).strokeColor(COLOURS.border).stroke()
  doc.rect(24, 24, width - 48, 8).fillColor(COLOURS.primary).fill()

  // The EU JOBS logo (name and tagline are part of the image).
  doc.image(LOGO, inner.x, inner.y - 6, { height: 40 })

  const centre = (fontName, size, colour, value, y) => doc.font(fontName).fontSize(size).fillColor(colour).text(value, inner.x, y, { width: inner.width, align: 'center' })
  centre('SemiBold', 12, COLOURS.primary, text('title').toUpperCase(), 140)
  centre('Regular', 13, COLOURS.muted, text('intro'), 180)
  centre('Bold', 34, COLOURS.ink, holderName, 205)
  centre('Regular', 13, COLOURS.muted, text('completed'), doc.y + 12)
  centre('SemiBold', 22, COLOURS.ink, courseTitle, doc.y + 8)
  const date = new Intl.DateTimeFormat(LOCALE[language], { dateStyle: 'long', timeZone: timeZone || 'UTC' }).format(issuedAt)
  centre('Regular', 12, COLOURS.muted, text('issued', { date }), doc.y + 16)

  // The code, the check link and the QR code, bottom right; the note on what a certificate means, bottom left.
  const qrSize = 92
  const qrX = inner.x + inner.width - qrSize
  const qrY = inner.y + inner.height - qrSize
  drawQr(doc, verifyUrl, qrX, qrY, qrSize)
  const block = { x: inner.x + inner.width / 2, width: inner.width / 2 - qrSize - 16 }
  doc.font('Regular').fontSize(9).fillColor(COLOURS.muted).text(text('code'), block.x, qrY + 8, { width: block.width, align: 'right' })
  doc.font('Bold').fontSize(14).fillColor(COLOURS.ink).text(code, block.x, doc.y + 2, { width: block.width, align: 'right' })
  doc.font('Regular').fontSize(9).fillColor(COLOURS.muted).text(text('verify'), block.x, doc.y + 8, { width: block.width, align: 'right' })
  doc.font('Regular').fontSize(9).fillColor(COLOURS.primary).text(verifyUrl, block.x, doc.y + 2, { width: block.width, align: 'right', link: verifyUrl })
  doc.font('Regular').fontSize(8.5).fillColor(COLOURS.muted).text(text('note'), inner.x, qrY + 40, { width: inner.width / 2 - 24 })

  doc.end()
  return done
}
