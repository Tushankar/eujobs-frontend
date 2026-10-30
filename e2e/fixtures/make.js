import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
// The server's in-memory builders (pdfkit, sharp, archiver), so the API tests and the browser checks use the same files.
import { docx, executable, image, imagePdf, MB, padded, textPdf } from '../../server/test/helpers/fixtures.js'

/*
 * P11, part 1: test files for the Phase 3 browser checks, written outside the repo. Existing files are kept,
 * so a run only builds what is missing. Run directly with `node e2e/fixtures/make.js`.
 */
export const FIXTURES_DIR = 'C:/eujobs-data/fixtures'

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
}

export async function makeFixtures() {
  mkdirSync(FIXTURES_DIR, { recursive: true })
  for (const [name, build] of Object.entries(FIXTURES)) {
    const path = join(FIXTURES_DIR, name)
    if (!existsSync(path)) writeFileSync(path, await build())
  }
}

export const fixture = (name) => join(FIXTURES_DIR, name)

if (import.meta.main) {
  await makeFixtures()
  console.log(`Fixtures ready in ${FIXTURES_DIR}`)
}
