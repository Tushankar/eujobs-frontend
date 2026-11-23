/*
 * API endpoint check (2026-11-23): every feature injects its endpoints into the one RTK Query `api`, so two features
 * that pick the same endpoint name share a cache entry and one reads the other's data. That crashed the agency
 * Overview on production (the agency's books read as recruiter talent cards). RTK only warns in dev, so the build
 * fails here instead. Runs before `npm run build`.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const SRC = fileURLToPath(new URL('../src/', import.meta.url))
const ENDPOINT = /\b([A-Za-z]\w*):\s*build\.(?:query|mutation|infiniteQuery)\s*\(/g

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return files(path)
    return /\.(js|jsx)$/.test(name) ? [path] : []
  })
}

const seen = new Map()
for (const file of files(SRC)) {
  for (const [, name] of readFileSync(file, 'utf8').matchAll(ENDPOINT)) {
    seen.set(name, [...(seen.get(name) ?? []), relative(SRC, file)])
  }
}

const duplicates = [...seen].filter(([, where]) => where.length > 1)
if (duplicates.length) {
  console.error(`API endpoint check failed (${duplicates.length}): each endpoint name must be unique across features.`)
  for (const [name, where] of duplicates) console.error(`  ${name}: ${where.join(', ')}`)
  process.exit(1)
}
console.log(`API endpoint check passed: ${seen.size} unique endpoint names.`)
