import { existsSync, mkdirSync, truncateSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
// The server's in-memory builders (pdfkit, sharp, archiver), so the API tests and the browser checks use the same files.
import { docx, executable, image, imagePdf, MB, mp4Header, padded, textPdf } from '../../server/test/helpers/fixtures.js'
import { launchChrome } from '../lib/browser.js'

/*
 * P11: test files for the browser checks (part 1 Phase 3, part 2 Phase 4, part 3 Phase 8), written outside the repo.
 * Existing files are kept, so a run only builds what is missing. Run directly with `node e2e/fixtures/make.js`.
 */
export const FIXTURES_DIR = 'C:/eujobs-data/fixtures'

// P11 part 3: ~30 s clips recorded by Chrome's MediaRecorder from a canvas and a tone, at a low bitrate (about 1 MB).
const RECORDED = { 'lesson.webm': 'video/webm;codecs=vp8,opus', 'lesson.mp4': 'video/mp4;codecs=avc1,mp4a.40.2' }
const RECORD_SECONDS = 30
// Size tests: a real header followed by zeros up to the size (sparse on disk), so nothing large is held in memory.
const SIZED = { 'video-501mb.mp4': [mp4Header, 501 * MB] }

async function record(page, mimeType, seconds) {
  const base64 = await page.evaluate(
    async (type, ms) => {
      const canvas = Object.assign(document.createElement('canvas'), { width: 320, height: 180 })
      const draw = canvas.getContext('2d')
      const audio = new AudioContext()
      const tone = audio.createOscillator()
      const output = audio.createMediaStreamDestination()
      tone.connect(output)
      tone.start()
      const stream = new MediaStream([...canvas.captureStream(25).getVideoTracks(), ...output.stream.getAudioTracks()])
      const recorder = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 250_000 })
      const chunks = []
      recorder.ondataavailable = (event) => chunks.push(event.data)
      const started = performance.now()
      const timer = setInterval(() => {
        const elapsed = (performance.now() - started) / 1000
        draw.fillStyle = `hsl(${(elapsed * 12) % 360} 60% 45%)`
        draw.fillRect(0, 0, 320, 180)
        draw.fillStyle = '#fff'
        draw.font = 'bold 40px sans-serif'
        draw.fillText(`${elapsed.toFixed(1)} s`, 90, 105)
      }, 40)
      recorder.start(1000)
      await new Promise((resolve) => setTimeout(resolve, ms))
      await new Promise((resolve) => {
        recorder.onstop = resolve
        recorder.stop()
      })
      clearInterval(timer)
      const bytes = new Uint8Array(await new Blob(chunks).arrayBuffer())
      let binary = ''
      for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000))
      return btoa(binary)
    },
    mimeType,
    seconds * 1000,
  )
  return Buffer.from(base64, 'base64')
}

async function makeRecordings() {
  const missing = Object.entries(RECORDED).filter(([name]) => !existsSync(join(FIXTURES_DIR, name)))
  if (!missing.length) return
  const browser = await launchChrome()
  try {
    const page = await browser.newPage()
    await Promise.all(missing.map(async ([name, type]) => writeFileSync(join(FIXTURES_DIR, name), await record(page, type, RECORD_SECONDS))))
  } finally {
    await browser.close()
  }
}

const FIXTURES = {
  'cv-text.pdf': () => textPdf(['Morgan Lee', 'Product designer with six years of experience in design systems, research and prototyping.']),
  'cv-scanned.pdf': () => imagePdf(),
  'cv.docx': () => docx('Morgan Lee, product designer. Design systems, user research and accessible interfaces.'),
  'photo.jpg': () => image('jpeg', { width: 600, height: 600, background: '#5a7b9e' }),
  'photo.png': () => image('png', { width: 640, height: 480, background: '#a77850' }),
  'photo.webp': () => image('webp', { width: 500, height: 500, background: '#527b72' }),
  'photo.gif': () => image('gif'),
  // About 4 MB and about 6 MB of real PNG data: under and over the 5 MB photo limit.
  'photo-4mb.png': () => image('png', { width: 1180, height: 1180, noise: true }),
  'photo-6mb.png': () => image('png', { width: 1450, height: 1450, noise: true }),
  'passport.jpg': () => image('jpeg', { width: 880, height: 620, background: '#dfe8f4' }),
  'evidence.pdf': () => textPdf(['Sample evidence document', 'Created for the browser checks. It is not a real document.']),
  'cv-11mb.pdf': async () => padded(await textPdf('Oversized'), 11 * MB),
  'program.jpg': () => executable(),
  // P11, part 2 (Phase 4): KYC files, logos and wrong types.
  'kyc-identity.pdf': () => textPdf(['Identity document (sample)', 'Created for the browser checks. It is not a real document.']),
  'kyc-registration.png': () => image('png', { width: 800, height: 560, background: '#f8f9fb' }),
  'logo.png': () => image('png', { width: 256, height: 256, background: '#2c6b46' }),
  'logo-3mb.png': () => image('png', { width: 1000, height: 1000, noise: true }),
  'logo-script.svg': () =>
    Buffer.from(
      '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" onload="alert(1)"><script>alert(2)</script><rect width="64" height="64" fill="#5b4ba8" onclick="alert(3)"/></svg>',
    ),
  'notes.txt': () => Buffer.from('Plain text is not a KYC document.'),
  // P11, part 3 (Phase 8): course cover and lesson files, and the oversized ones (M-102, M-107).
  'cover.jpg': () => image('jpeg', { width: 960, height: 540, background: '#3a6ea5' }),
  'worksheet.pdf': () => textPdf(['Lesson worksheet', 'Map one flow from the first screen to the goal, then list its states.']),
  'worksheet-51mb.pdf': async () => padded(await textPdf(['Oversized worksheet']), 51 * MB),
}

export async function makeFixtures() {
  mkdirSync(FIXTURES_DIR, { recursive: true })
  for (const [name, build] of Object.entries(FIXTURES)) {
    const path = join(FIXTURES_DIR, name)
    if (!existsSync(path)) writeFileSync(path, await build())
  }
  for (const [name, [head, size]] of Object.entries(SIZED)) {
    const path = join(FIXTURES_DIR, name)
    if (existsSync(path)) continue
    writeFileSync(path, head())
    truncateSync(path, size)
  }
  await makeRecordings()
}

export const fixture = (name) => join(FIXTURES_DIR, name)

if (import.meta.main) {
  await makeFixtures()
  console.log(`Fixtures ready in ${FIXTURES_DIR}`)
}
