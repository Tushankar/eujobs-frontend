import { fieldError } from './errors.js'

/*
 * Skills are free text (M-034): the typed name is kept and `key` (lower-cased) compares them. Skill overlap
 * has one definition everywhere (M-052): the job's required + preferred skills the candidate lists.
 */
export const skillKey = (name) => name.toLocaleLowerCase()

/** Names → [{ name, key }], refusing a case-insensitive duplicate on `field`. */
export function skillEntries(names, field) {
  const keys = names.map(skillKey)
  const duplicate = names.find((name, index) => keys.indexOf(keys[index]) !== index)
  if (duplicate) throw fieldError({ [field]: 'duplicate' }, { skill: duplicate })
  return names.map((name, index) => ({ name, key: keys[index] }))
}

/** M-052: `skills` are the candidate's [{ key }]. `missing` lists the required skills not matched. */
export function skillOverlap(skills, job) {
  const keys = new Set(skills.map((skill) => skill.key))
  const all = [...job.requiredSkills, ...job.preferredSkills]
  return {
    matched: all.filter((skill) => keys.has(skill.key)).map((skill) => skill.name),
    missing: job.requiredSkills.filter((skill) => !keys.has(skill.key)).map((skill) => skill.name),
    requiredMatched: job.requiredSkills.filter((skill) => keys.has(skill.key)).length,
    total: all.length,
  }
}

/** Accent- and case-insensitive text for keyword search (§3.6). */
export const searchText = (text) => String(text ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase()

/** §3.6: every keyword of `query` appears somewhere in `haystack` (already searchText). */
export function matchesKeywords(query, haystack) {
  const words = searchText(query).split(/\s+/).filter(Boolean)
  return words.every((word) => haystack.includes(word))
}
