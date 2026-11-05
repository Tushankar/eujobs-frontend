import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CANDIDATES } from '../server/seed/data/candidates.js'
import { DEMO_ACCOUNTS } from '../server/seed/data/demo.js'
import { APPLICANT_COMPANY, COMPANIES } from '../server/seed/data/recruiters.js'

/*
 * node e2e/audit-static.js (Phase 12 task 5, P12-07): nothing static may remain in the client (§0.2). It reads
 * client/src (and client/index.html) and lists every:
 *   - `useLocalStorage(` call, or direct localStorage/sessionStorage use, outside the sites §2.15 allows;
 *   - file in a `data/` folder (mock data), except the three UI-config files the owner kept (P12-Q6);
 *   - currency symbol or `en-US` in code or copy (formats come from Intl, money from the server);
 *   - seeded person or company name (the demo data lives in the database; the names are read from the seed here).
 * Exits 1 with the findings, 0 when there are none.
 */
const CLIENT = fileURLToPath(new URL('../client/', import.meta.url))
const SRC = join(CLIENT, 'src')

// §2.15: the auth token, the anonymous language and country, the dismissed overview insight, the recruiter's match job.
const STORAGE_SITES = ['app/token.js', 'lib/preferences.js', 'hooks/useLocalStorage.js']
const USE_LOCAL_STORAGE_SITES = ['hooks/useLocalStorage.js', 'features/candidate/overview/components/InsightCard.jsx', 'features/recruiter/find-candidates/hooks/useMatchJob.js']
// P12-Q6: route and icon config, no records.
const DATA_FILES_KEPT = {
  'features/auth/data/onboarding.js': 'the recruiter onboarding step routes',
  'features/auth/data/workspaceChoices.js': 'the sign-in and sign-up portal tiles',
  'features/help/data/help.js': 'the Help page link destinations',
}

const seededNames = [
  ...DEMO_ACCOUNTS.map((account) => account.fullName),
  ...CANDIDATES.map((candidate) => candidate.fullName),
  ...COMPANIES.flatMap((company) => [company.recruiter.fullName, company.name]),
  APPLICANT_COMPANY.name,
]
  .filter(Boolean)
  // One-word company names (Stripe, Figma, Linear, …) are ordinary words and product names in code; seeded people
  // and multi-word companies are not.
  .filter((name, index, all) => name.includes(' ') && all.indexOf(name) === index)

const RULES = [
  { id: 'currency-symbol', test: (line) => /[£€¥₹]|US\$|\$\d/.test(line) },
  { id: 'en-US', test: (line) => /en-US/.test(line) },
  { id: 'seeded-name', test: (line) => seededNames.find((name) => line.includes(name)) },
]

function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => (entry.isDirectory() ? files(join(dir, entry.name)) : [join(dir, entry.name)]))
}

const findings = []
const sources = [...files(SRC), join(CLIENT, 'index.html')].filter((file) => /\.(jsx?|json|css|html)$/.test(file))
for (const file of sources) {
  const path = relative(SRC, file).split(sep).join('/')
  const shown = relative(join(CLIENT, '..'), file).split(sep).join('/')
  if (path.split('/').includes('data') && !DATA_FILES_KEPT[path]) findings.push(`${shown}: mock-data-file`)
  readFileSync(file, 'utf8')
    .split('\n')
    .forEach((line, index) => {
      const where = `${shown}:${index + 1}`
      if (/useLocalStorage\(/.test(line) && !USE_LOCAL_STORAGE_SITES.includes(path)) findings.push(`${where}: useLocalStorage outside §2.15`)
      if (/\b(localStorage|sessionStorage)\b/.test(line) && !STORAGE_SITES.includes(path)) findings.push(`${where}: browser storage outside §2.15`)
      for (const rule of RULES) {
        const hit = rule.test(line)
        if (hit) findings.push(`${where}: ${rule.id}${typeof hit === 'string' ? ` (${hit})` : ''}: ${line.trim().slice(0, 120)}`)
      }
    })
}

console.log(`Static-data audit of client/src: ${sources.length} files, ${seededNames.length} seeded names checked, ${Object.keys(DATA_FILES_KEPT).length} data/ config files kept (P12-Q6).`)
for (const finding of findings) console.log(`  ${finding}`)
console.log(`${findings.length} findings`)
process.exitCode = findings.length ? 1 : 0
