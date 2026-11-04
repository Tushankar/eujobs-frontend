/*
 * Translation check (Phase 11): every en namespace has an es and fr file with every key, the plural
 * forms each language needs, the same {{placeholders}} and <tags>, and no keys that en does not have.
 * Runs before `npm run build` (and as `npm run check:i18n`); any gap fails it.
 */
import { readdirSync, readFileSync } from 'node:fs'

const LOCALES = new URL('../src/i18n/locales/', import.meta.url)
const SOURCE = 'en'
const PLURAL = /_(zero|one|two|few|many|other)$/
const languages = readdirSync(LOCALES).filter((name) => name !== SOURCE)
const read = (language, file) => JSON.parse(readFileSync(new URL(`${language}/${file}`, LOCALES), 'utf8'))

/** Flattens a namespace to `a.b.c` → value (arrays keep their index: `a.0`). */
const flatten = (node, prefix = '', out = {}) => {
  for (const [key, value] of Object.entries(node)) {
    const path = `${prefix}${key}`
    if (value && typeof value === 'object') flatten(value, `${path}.`, out)
    else out[path] = value
  }
  return out
}
const tokens = (text) => [...String(text).matchAll(/\{\{\s*([\w.]+)[^}]*\}\}|<\/?(\w+)\s*\/?>/g)].map((match) => match[1] ?? `<${match[2]}>`).sort().join(' ')

const problems = []
for (const file of readdirSync(new URL(`${SOURCE}/`, LOCALES)).filter((name) => name.endsWith('.json'))) {
  const namespace = file.replace('.json', '')
  const source = flatten(read(SOURCE, file))
  for (const language of languages) {
    let target
    try {
      target = flatten(read(language, file))
    } catch (error) {
      problems.push(`${language}/${file}: ${error.code === 'ENOENT' ? 'missing file' : error.message}`)
      continue
    }
    const categories = new Intl.PluralRules(language).resolvedOptions().pluralCategories
    const expected = new Map()
    const isPlural = (key) => PLURAL.test(key) && source[key.replace(PLURAL, '_other')] !== undefined
    for (const [key, value] of Object.entries(source)) {
      if (!isPlural(key)) {
        expected.set(key, value)
        continue
      }
      // A plural key needs every form of the target language, each compared with the en "other" form.
      const base = key.replace(PLURAL, '')
      if (expected.has(`${base}_other`)) continue
      const other = source[`${base}_other`] ?? value
      for (const category of categories) expected.set(`${base}_${category}`, key.endsWith('_zero') ? value : other)
      if (source[`${base}_zero`] !== undefined) expected.set(`${base}_zero`, source[`${base}_zero`])
    }
    for (const [key, value] of expected) {
      const translated = target[key]
      if (translated === undefined) problems.push(`${language}/${namespace}: missing ${key}`)
      else if (typeof translated !== typeof value) problems.push(`${language}/${namespace}: ${key} is a ${typeof translated}, en is a ${typeof value}`)
      else if (typeof value === 'string' && !translated.trim()) problems.push(`${language}/${namespace}: ${key} is empty`)
      else if (typeof value === 'string' && tokens(translated) !== tokens(value) && !(isPlural(key) && tokens(translated).replace('count', '').trim() === tokens(value).replace('count', '').trim()))
        problems.push(`${language}/${namespace}: ${key} has ${tokens(translated) || 'no placeholders'}, en has ${tokens(value) || 'none'}`)
    }
    for (const key of Object.keys(target)) if (!expected.has(key)) problems.push(`${language}/${namespace}: ${key} is not an en key`)
  }
}

if (problems.length) {
  console.error(`Translation check failed (${problems.length}):\n  ${problems.join('\n  ')}`)
  process.exit(1)
}
console.log(`Translation check passed: ${languages.join(', ')} match en.`)
