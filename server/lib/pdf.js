import { fileURLToPath } from 'node:url'
import PDFDocument from 'pdfkit'
import QRCode from 'qrcode'
import { interpolate, t } from './i18n.js'

/*
 * The certificate PDF (M-105, U17, P8-Q3), design "Heritage" (2026-11-25): A4 landscape on ivory, a guilloché border with
 * microprint, a gold seal, the embedded Inter, Cinzel and Cormorant Garamond fonts (Latin Extended), the chrome in the
 * holder's language, the holder's name and the course as authored, the issue date in the holder's format (OQ-6b
 * regions), the code and a vector QR code with the link to the public check. Laid out on a 1123 × 794 grid (the page at
 * 96 dpi) and scaled to points, so the numbers match the design canvas.
 */
const asset = (name) => fileURLToPath(new URL(`../assets/${name}`, import.meta.url))
const FONTS = {
  Regular: 'Inter-Regular',
  SemiBold: 'Inter-SemiBold',
  Bold: 'Inter-Bold',
  Display: 'Cinzel-SemiBold',
  Serif: 'CormorantGaramond-SemiBold',
  SerifItalic: 'CormorantGaramond-MediumItalic',
}
const LOGO = asset('logo.png')
const LOCALE = { en: 'en-IE', es: 'es-ES', fr: 'fr-FR' }
// The brand never changes with the language (M-193).
const BRAND = 'EU Jobs'
const COLOURS = {
  paper: '#FDFBF5',
  navy: '#012B74',
  blue: '#0263DC',
  ink: '#0F1B33',
  body: '#3F4A5E',
  muted: '#5B6475',
  gold: '#B08D3A',
  goldDark: '#6E5214',
  goldText: '#45330A',
  goldLight: '#F3DD94',
  link: '#0247C1',
  mark: '#EEF0F5',
  qrBorder: '#C9CFD9',
}
const W = 1123
const H = 794
// The content box inside the border.
const BOX = { x: 100, width: 923 }
// The EU Jobs mark (client/src/assets/images/logo-mark-white.svg), 242.97 × 153.66.
const MARK = [
  'M31.08 64.11C30.08 50.8 46.34 39 53.22 38.93H127.22C126.02 77.63 49.97 49.98 31.08 64.11Z',
  'M17 98.11C16 84.57 32.89 72.99 39.77 72.94H115.92C115.01 111.49 35.99 84.11 17 98.11Z',
  'M0 128.17C0.467 125.352 1.44 122.642 2.87 120.17C8.87 109.78 21.06 107.7 23.34 107.35L119.49 106.96C119.746 109.7 119.277 112.459 118.13 114.96C115.89 119.64 111.67 121.72 106.79 124.13C102.558 126.208 98.037 127.637 93.38 128.37L11.38 128.2L0 128.17Z',
  'M119.53 32.9C128.46 27.9 136.22 24.03 142.24 21.24C151 17.18 156.08 15.33 158.24 14.57C163.56 12.68 168.16 11.37 171.64 10.48C174.78 9.7 211.64 0.94 220.64 15.84C225.53 23.96 219.64 35.42 217.64 40.55C204.87 73.24 110.74 138.7 56.1 153.63C54.72 154.01 82.35 147.31 106.4 136.12C115.571 131.867 124.486 127.082 133.1 121.79C140.42 117.28 146.59 112.96 151.5 109.31C163.95 97.31 257.23 37.52 224.22 5.38C208.53 -10.96 146.45 13.23 119.53 32.9Z',
  'M162.01 91.9C161.859 90.85 161.779 89.791 161.77 88.73C161.92 76.06 161.69 52.02 161.47 39.63L135.75 39.74C136.95 61.09 131.95 87.03 140.43 107.32C143.43 105.24 146.43 103.14 149.52 100.97C153.79 97.94 157.94 94.91 162.01 91.9Z',
  'M242.97 39.74H233.81L218.19 60.07V93.02C217.958 95.139 217.374 97.204 216.46 99.13C211.52 109.41 197.23 112.35 185.39 112.36C180.427 112.342 175.595 110.767 171.574 107.857C167.554 104.947 164.548 100.849 162.98 96.14C159.51 98.88 155.82 101.62 151.87 104.34C148.53 106.63 145.23 108.74 141.98 110.7C143.993 114.637 146.593 118.244 149.69 121.4C158.15 130.33 172.85 134.58 191.15 134.64C225.62 136.09 243.93 111.2 242.93 79.93L242.97 39.74Z',
]

const round = (value) => Math.round(value * 10) / 10

/** Guilloché: `count` sine waves, evenly out of phase, along the line from (x0, y0) to (x1, y1), as SVG path data. */
function waves(x0, y0, x1, y1, amp, period, count) {
  const length = Math.hypot(x1 - x0, y1 - y0)
  const [ux, uy] = [(x1 - x0) / length, (y1 - y0) / length]
  const steps = Math.ceil(length / 3)
  let path = ''
  for (let wave = 0; wave < count; wave++) {
    const phase = (wave * 2 * Math.PI) / count
    for (let step = 0; step <= steps; step++) {
      const along = (step / steps) * length
      const offset = amp * Math.sin((2 * Math.PI * along) / period + phase)
      path += `${step ? 'L' : 'M'}${round(x0 + ux * along - uy * offset)} ${round(y0 + uy * along + ux * offset)}`
    }
  }
  return path
}

/** The guilloché band all round the page, centred `inset` in from the edge. */
const frame = (inset, amp, period, count) => {
  const [left, top, right, bottom] = [inset, inset, W - inset, H - inset]
  return waves(left, top, right, top, amp, period, count) + waves(right, top, right, bottom, amp, period, count) + waves(right, bottom, left, bottom, amp, period, count) + waves(left, bottom, left, top, amp, period, count)
}

/** A rosette: `count` closed curves r = R + amp·sin(kθ + phase) around (cx, cy). */
function rosette(cx, cy, radius, amp, k, count) {
  let path = ''
  for (let curve = 0; curve < count; curve++) {
    const phase = (curve * 2 * Math.PI) / count
    for (let step = 0; step <= 720; step++) {
      const angle = (step / 720) * 2 * Math.PI
      const r = radius + amp * Math.sin(k * angle + phase)
      path += `${step ? 'L' : 'M'}${round(cx + r * Math.cos(angle))} ${round(cy + r * Math.sin(angle))}`
    }
    path += 'Z'
  }
  return path
}

/** The QR code's dark modules as filled squares, `size` wide, at (x, y). */
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

const strokePath = (doc, path, colour, width, opacity = 1) => doc.save().path(path).lineWidth(width).strokeOpacity(opacity).stroke(colour).restore()

/** The largest size from `max` down to `min` at which `value` fits on one line `width` wide. */
function fitSize(doc, font, value, max, min, width) {
  let size = max
  while (size > min && doc.font(font).fontSize(size).widthOfString(value) > width) size -= 1
  return size
}

/** Microprint along the inside of the border: one line per side, the tops of the letters facing out. */
function microprint(doc, inset) {
  const phrase = 'EU JOBS · CERTIFICATE OF COMPLETION · VERIFIED · '
  const sides = [
    [inset, inset, 0, W - 2 * inset],
    [W - inset, inset, 90, H - 2 * inset],
    [W - inset, H - inset, 180, W - 2 * inset],
    [inset, H - inset, 270, H - 2 * inset],
  ]
  doc.font('SemiBold').fontSize(4.2)
  const options = { characterSpacing: 0.4, lineBreak: false, baseline: 'alphabetic' }
  for (const [x, y, angle, length] of sides) {
    let line = phrase.repeat(Math.ceil(length / doc.widthOfString(phrase, options)) + 1)
    while (doc.widthOfString(line, options) > length) line = line.slice(0, -1)
    doc.save().translate(x, y).rotate(angle).fillColor(COLOURS.navy).fillOpacity(0.55).text(line, 0, 0, options).restore()
  }
}

/** Text set round a circle of `radius` from the left, clockwise over the top, spread over `length` (SVG textLength). */
function ringText(doc, value, cx, cy, radius, length) {
  const glyphs = [...value]
  const widths = glyphs.map((glyph) => doc.widthOfString(glyph))
  const gap = (length - widths.reduce((sum, width) => sum + width, 0)) / glyphs.length
  let along = 0
  glyphs.forEach((glyph, index) => {
    const angle = Math.PI + (along + widths[index] / 2) / radius
    doc.save().translate(cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)).rotate((angle * 180) / Math.PI + 90)
    doc.text(glyph, -widths[index] / 2, 0, { lineBreak: false, baseline: 'alphabetic' }).restore()
    along += widths[index] + gap
  })
}

/** The gold seal with its ribbons, drawn in a 150 × 196 box whose top left is (x, y). */
function seal(doc, x, y) {
  doc.save().translate(x, y)
  doc.polygon([50, 106], [73, 118], [61, 194], [49, 180], [34, 191]).fill(COLOURS.navy)
  doc.polygon([100, 106], [77, 118], [89, 194], [101, 180], [116, 191]).fill(COLOURS.blue)
  const gold = doc.linearGradient(0, 0, 150, 150)
  for (const [offset, colour] of [[0, '#7D5E1A'], [0.22, '#D9B85C'], [0.42, '#F6E7A6'], [0.6, '#C49D3E'], [0.8, '#ECD58B'], [1, '#8A6A1F']]) gold.stop(offset, colour)
  doc.path(rosette(75, 75, 67, 2.6, 44, 1)).lineWidth(0.6).fillAndStroke(gold, COLOURS.goldDark)
  doc.circle(75, 75, 61).lineWidth(0.8).stroke(COLOURS.goldDark)
  doc.font('Display').fontSize(7.4).fillColor(COLOURS.goldText)
  ringText(doc, 'EU JOBS · VERIFIED CERTIFICATE · AI POWERED CAREERS ·', 75, 75, 53, 326)
  doc.circle(75, 75, 45.5).lineWidth(0.8).stroke(COLOURS.goldDark)
  doc.circle(75, 75, 42).lineWidth(2.2).fillAndStroke(COLOURS.navy, gold)
  strokePath(doc, rosette(75, 75, 30, 4, 12, 4), '#FFFFFF', 0.5, 0.22)
  const scale = 38 / 242.97
  doc.save().translate(56, 50 + (38 - 153.66 * scale) / 2).scale(scale)
  for (const path of MARK) doc.path(path).fill(COLOURS.mark)
  doc.restore()
  doc.font('Display').fontSize(6.6).fillColor(COLOURS.goldLight).text('VERIFIED', 0, 104, { width: 150, align: 'center', characterSpacing: 1.6, lineBreak: false, baseline: 'alphabetic' })
  doc.restore()
}

/** A value over a rule over a small label, centred on `cx` with its label's foot at `bottom`. */
function signedLine(doc, cx, bottom, value, label) {
  const width = 230
  doc.font('SemiBold').fontSize(10.5).fillColor(COLOURS.muted).text(label.toUpperCase(), cx - 150, bottom - 13, { width: 300, align: 'center', characterSpacing: 1.9, lineBreak: false })
  doc.moveTo(cx - width / 2, bottom - 22).lineTo(cx + width / 2, bottom - 22).lineWidth(1).stroke(COLOURS.ink)
  doc.font('Serif').fontSize(23).fillColor(COLOURS.ink).text(value, cx - 150, bottom - 56, { width: 300, align: 'center', lineBreak: false })
}

/** Resolves with the PDF bytes. */
export function certificatePdf({ holderName, courseTitle, courseLevel, courseCategory, lessonCount, issuedAt, code, language, timeZone, verifyUrl }) {
  const text = (key, params) => interpolate(t(language, `certificate.${key}`), params)
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 0, info: { Title: `${text('title')} · ${courseTitle}`, Author: BRAND } })
  for (const [name, file] of Object.entries(FONTS)) doc.registerFont(name, asset(`fonts/${file}.ttf`))
  const chunks = []
  const done = new Promise((resolve, reject) => doc.on('data', (chunk) => chunks.push(chunk)).on('end', () => resolve(Buffer.concat(chunks))).on('error', reject))
  doc.scale(doc.page.width / W)
  // PDFKit breaks pages by unscaled coordinates (0–595 here), so the bottom margin goes below the grid's 794: one page.
  doc.page.margins.bottom = doc.page.height - H

  // The paper, the watermark rosette and the border: rule, guilloché band, rule, gold rule, microprint, corner medallions.
  doc.rect(0, 0, W, H).fill(COLOURS.paper)
  strokePath(doc, rosette(W / 2, 380, 220, 16, 40, 4) + rosette(W / 2, 380, 150, 10, 28, 4) + rosette(W / 2, 380, 80, 7, 18, 3), COLOURS.navy, 0.7, 0.05)
  doc.rect(22, 22, W - 44, H - 44).lineWidth(1.4).stroke(COLOURS.navy)
  strokePath(doc, frame(36, 7, 42, 6), COLOURS.navy, 0.55, 0.8)
  strokePath(doc, frame(36, 3, 14, 3), COLOURS.blue, 0.4, 0.45)
  doc.rect(50, 50, W - 100, H - 100).lineWidth(1.4).stroke(COLOURS.navy)
  const goldRule = doc.linearGradient(0, 0, W, H)
  for (const [offset, colour] of [[0, '#9C7A2C'], [0.3, '#E2C574'], [0.55, '#A98431'], [0.8, '#E8CF82'], [1, '#9C7A2C']]) goldRule.stop(offset, colour)
  doc.rect(56, 56, W - 112, H - 112).lineWidth(1).stroke(goldRule)
  microprint(doc, 64)
  const corners = [[36, 36], [W - 36, 36], [W - 36, H - 36], [36, H - 36]]
  for (const [x, y] of corners) doc.circle(x, y, 15).lineWidth(1).fillAndStroke(COLOURS.paper, COLOURS.navy)
  strokePath(doc, corners.map(([x, y]) => rosette(x, y, 9.5, 2.5, 8, 3)).join(''), COLOURS.navy, 0.5)

  // The logo (name and tagline are part of the image), the title and its ornament.
  doc.image(LOGO, W / 2 - 78, 80, { fit: [156, 50], align: 'center', valign: 'center' })
  doc.font('Display').fontSize(24).fillColor(COLOURS.navy).text(text('title').toUpperCase(), BOX.x, 148, { width: BOX.width, align: 'center', characterSpacing: 3.4 })
  const ornament = 197
  doc.save().lineWidth(1).strokeColor(COLOURS.gold).fillColor(COLOURS.gold)
  doc.moveTo(W / 2 - 112, ornament).lineTo(W / 2 - 22, ornament).moveTo(W / 2 + 22, ornament).lineTo(W / 2 + 112, ornament).stroke()
  for (const dx of [-13, 13]) doc.polygon([W / 2 + dx, ornament - 4], [W / 2 + dx + 4, ornament], [W / 2 + dx, ornament + 4], [W / 2 + dx - 4, ornament]).stroke()
  doc.polygon([W / 2, ornament - 6], [W / 2 + 6, ornament], [W / 2, ornament + 6], [W / 2 - 6, ornament]).fill()
  doc.restore()

  // Who, what and how: the name and the course title shrink to stay on one line.
  const centre = (font, size, colour, value, y, options = {}) => doc.font(font).fontSize(size).fillColor(colour).text(value, BOX.x, y, { width: BOX.width, align: 'center', ...options })
  centre('SerifItalic', 22, COLOURS.body, text('intro'), 212)
  centre('Serif', fitSize(doc, 'Serif', holderName, 76, 44, BOX.width), COLOURS.ink, holderName, doc.y - 2, { height: 110, ellipsis: true })
  const level = courseLevel && text(`level.${courseLevel}`)
  centre('SerifItalic', 22, COLOURS.body, level ? text('completedLevel', { level }) : text('completed'), doc.y + 2)
  centre('Serif', fitSize(doc, 'Serif', courseTitle, 38, 22, BOX.width), COLOURS.navy, courseTitle, doc.y)
  const details = [lessonCount && text(`lessons.${lessonCount === 1 ? 'one' : 'other'}`, { count: lessonCount }), text('passed'), courseCategory].filter(Boolean)
  centre('SemiBold', 11.5, COLOURS.muted, details.join('  ·  ').toUpperCase(), doc.y + 10, { characterSpacing: 2 })

  // The date, the seal and the issuer.
  const columnCentre = (BOX.width - 48) / 6
  const date = new Intl.DateTimeFormat(LOCALE[language], { dateStyle: 'long', timeZone: timeZone || 'UTC' }).format(issuedAt)
  signedLine(doc, BOX.x + columnCentre, 632, date, text('dateLabel'))
  seal(doc, W / 2 - 75, 466)
  signedLine(doc, BOX.x + BOX.width - columnCentre, 632, BRAND, text('issuerLabel'))

  // The QR code, the code and the check link, bottom left; the note on what a certificate means, bottom right.
  doc.rect(BOX.x, 662, 58, 58).lineWidth(0.75).fillAndStroke('#FFFFFF', COLOURS.qrBorder)
  drawQr(doc, verifyUrl, BOX.x + 4, 666, 50)
  const footer = { x: BOX.x + 72, width: 420 }
  doc.font('Regular').fontSize(10.5).fillColor(COLOURS.muted).text(`${text('code')} `, footer.x, 666, { continued: true, width: footer.width, lineBreak: false })
  doc.font('Bold').fillColor(COLOURS.ink).text(code, { characterSpacing: 0.5 })
  doc.font('Regular').fillColor(COLOURS.muted).text(text('verify'), footer.x, 681, { width: footer.width, lineBreak: false })
  doc.fillColor(COLOURS.link).text(verifyUrl, footer.x, 696, { width: footer.width, lineBreak: false, link: verifyUrl })
  const note = { width: 330, options: { width: 330, align: 'right', lineGap: 3 } }
  doc.font('Regular').fontSize(10.5)
  doc.fillColor(COLOURS.muted).text(text('note'), BOX.x + BOX.width - note.width, 720 - doc.heightOfString(text('note'), note.options), note.options)

  doc.end()
  return done
}
