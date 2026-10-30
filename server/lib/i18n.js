import { readFileSync } from 'node:fs'
import { ENUMS } from '../config/enums.js'

/* Server dictionaries (§2.11): emails now; certificate PDF, CSV labels and AI language names later. */
const load = (language) => JSON.parse(readFileSync(new URL(`../i18n/${language}.json`, import.meta.url), 'utf8'))

export const dictionaries = Object.fromEntries(ENUMS.language.map((language) => [language, load(language)]))

/** The value at a dotted key; throws on a missing key so a gap never ships silently. */
export function t(language, key) {
  const value = key.split('.').reduce((node, part) => node?.[part], dictionaries[language])
  if (value === undefined) throw new Error(`Missing i18n key ${language}:${key}`)
  return value
}

export function interpolate(text, params) {
  return text.replace(/\{\{(\w+)\}\}/g, (match, name) => String(params[name] ?? ''))
}
