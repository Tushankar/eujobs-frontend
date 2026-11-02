import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
// The server's in-memory builders (pdfkit, sharp, archiver), so the API tests and the browser checks use the same files.
import { docx, executable, image, imagePdf, MB, padded, textPdf } from '../../server/test/helpers/fixtures.js'

/*
 * P11: test files for the browser checks (part 1 Phase 3, part 2 Phase 4), written outside the repo. Existing files are kept,
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
