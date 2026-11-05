import { mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { acquireTestLock } from '../server/test/lock.js'
import { makeFixtures } from './fixtures/make.js'
import { launchChrome, openPage, screenshot } from './lib/browser.js'
import { ARTIFACTS_DIR, ROOT, seedCredentials, WEB_URL } from './lib/env.js'
import { seedTestDatabase, startStack, stopStack } from './lib/stack.js'
import { resetTestState } from './lib/testApi.js'

/*
 * node e2e/run.js <all | phase-N | sweep | scenario-file-name[,more]>
 * Seeds eujobs_test, starts the API and Vite, runs the scenarios in the local Chrome per viewport,
 * prints a PASS/FAIL table and exits non-zero on any failure (§2.13).
 */
const SCENARIOS_DIR = new URL('./scenarios/', import.meta.url)

/** The phase group of a scenario file (p05, p11b, …; the English sweep is its own group). */
const groupOf = (file) => file.match(/^(p\d{2}[a-z]?)-/)?.[1] ?? file

function selectScenarioFiles(target) {
  const files = readdirSync(SCENARIOS_DIR).filter((file) => file.endsWith('.js')).sort()
  // P12-Q1: every scenario of every phase (temporary zz-* files are not part of it) and the sweep.
  if (target === 'all') return files.filter((file) => /^p\d{2}[a-z]?-/.test(file) || file === 'sweep.js')
  const phase = target?.match(/^phase-(\d+)$/)?.[1]
  if (phase) return files.filter((file) => file.startsWith(`p${phase.padStart(2, '0')}-`))
  // One scenario file name, or several separated by commas.
  const names = new Set((target ?? '').split(',').map((name) => `${name}.js`))
  return files.filter((file) => names.has(file))
}

const target = process.argv[2]
const files = selectScenarioFiles(target)
if (!files.length) {
  console.error('Usage: node e2e/run.js <all | phase-N | sweep | scenario-file-name[,more]>')
  process.exit(2)
}
// One run at a time on eujobs_test and ports 5100/5174, across every session on this machine.
acquireTestLock(`node e2e/run.js ${target}`)
const scenarios = await Promise.all(files.map(async (file) => (await import(new URL(file, SCENARIOS_DIR))).default))

const runDir = join(ARTIFACTS_DIR, `${new Date().toISOString().replace(/[:.]/g, '-')}-${target}`)
mkdirSync(runDir, { recursive: true })
const results = []
let browser

try {
  await makeFixtures()
  seedTestDatabase()
  await startStack(runDir)
  browser = await launchChrome()

  for (const [index, scenario] of scenarios.entries()) {
    // P12-Q1: each phase group starts on a fresh seed, the state it was verified on; the stack stays up.
    if (index > 0 && groupOf(files[index]) !== groupOf(files[index - 1])) {
      console.log(`Reseeding eujobs_test before ${groupOf(files[index])}`)
      seedTestDatabase()
    }
    for (const viewport of scenario.viewports) {
      const contexts = []
      const shotsDir = join(runDir, scenario.name.replace(/[^a-z0-9-]+/gi, '_'), viewport)
      const result = { scenario: scenario.name, viewport, notes: [] }
      const ctx = {
        viewport,
        runDir,
        webUrl: WEB_URL,
        seedCredentials,
        /**
         * A page with the standard checks attached: in a fresh browser context (own storage), or as
         * another tab of `context` (same session).
         */
        async newPage(context) {
          if (!context) {
            context = await browser.createBrowserContext()
            contexts.push(context)
          }
          return openPage(context, viewport)
        },
        screenshot: (page, name) => screenshot(page, shotsDir, name),
        note: (text) => result.notes.push(text),
        check(condition, message) {
          if (!condition) throw new Error(message)
        },
        assertClean(issues, label) {
          if (issues.length) throw new Error(`${label}: ${issues.join('; ')}`)
        },
      }
      const started = Date.now()
      try {
        // Each scenario starts with fresh rate limits and an empty mail capture.
        await resetTestState()
        await scenario.run(ctx)
        result.status = 'PASS'
      } catch (error) {
        result.status = 'FAIL'
        result.detail = error.message
        // Keep what every open tab showed at the moment of failure.
        const pages = (await Promise.all(contexts.map((context) => context.pages()))).flat()
        for (const [index, page] of pages.entries()) await ctx.screenshot(page, `failure-${index + 1}`).catch(() => {})
      }
      result.seconds = ((Date.now() - started) / 1000).toFixed(1)
      result.screenshots = relative(ROOT, shotsDir)
      results.push(result)
      await Promise.all(contexts.map((context) => context.close()))
    }
  }
} catch (error) {
  results.push({ scenario: 'harness', viewport: '-', status: 'FAIL', detail: error.message, notes: [] })
} finally {
  await browser?.close()
  stopStack()
}

writeFileSync(join(runDir, 'results.json'), JSON.stringify(results, null, 2))
console.log(`\n${'Scenario'.padEnd(40)} ${'View'.padEnd(5)} ${'Result'.padEnd(7)} ${'Time'.padStart(7)}  Screenshots`)
for (const r of results) {
  console.log(`${r.scenario.padEnd(40)} ${r.viewport.padEnd(5)} ${r.status.padEnd(7)} ${String(r.seconds ?? '-').padStart(6)}s  ${r.screenshots ?? ''}`)
  for (const note of r.notes) console.log(`    note: ${note}`)
  if (r.detail) console.log(`    ${r.detail.replace(/\n/g, '\n    ')}`)
}
const failed = results.filter((r) => r.status !== 'PASS').length
console.log(`\n${results.length - failed} passed, ${failed} failed. Artifacts: ${relative(ROOT, runDir)}`)
process.exitCode = failed ? 1 : 0
