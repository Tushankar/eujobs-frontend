import { fieldError } from './errors.js'

/*
 * Skills are free text (M-034): the typed name is kept and `key` (lower-cased) refuses duplicates within one list.
 * Matching across people, jobs and courses compares canonical forms instead, so "React js", "ReactJS" and "React" are
 * one skill: `skillCanon` (code: case, accents, spaces, dots and hyphens, a trailing "js", common aliases) of the typed
 * name and of the stored `standard`, the English standard name OpenAI gave when the skill was saved (typos, synonyms,
 * other languages, any profession; lib/ai.js addStandardNames). Skill overlap has one definition everywhere (M-052): the job's required + preferred
 * skills the candidate lists.
 */
export const skillKey = (name) => name.toLocaleLowerCase()

// Compact canonical form → the form it stands for. Keys and values are already compact (see skillCanon).
const ALIASES = {
  js: 'javascript',
  ecmascript: 'javascript',
  es6: 'javascript',
  vanillajavascript: 'javascript',
  ts: 'typescript',
  py: 'python',
  python3: 'python',
  golang: 'go',
  csharp: 'c#',
  cplusplus: 'c++',
  cpp: 'c++',
  net: 'dotnet',
  netcore: 'dotnet',
  aspnet: 'dotnet',
  aspnetcore: 'dotnet',
  postgres: 'postgresql',
  postgre: 'postgresql',
  psql: 'postgresql',
  postgressql: 'postgresql',
  mongo: 'mongodb',
  mssql: 'sqlserver',
  microsoftsqlserver: 'sqlserver',
  k8s: 'kubernetes',
  amazonwebservices: 'aws',
  googlecloud: 'gcp',
  googlecloudplatform: 'gcp',
  microsoftazure: 'azure',
  msazure: 'azure',
  rest: 'restapi',
  restapis: 'restapi',
  restful: 'restapi',
  restfulapi: 'restapi',
  restfulapis: 'restapi',
  restfulservices: 'restapi',
  ci: 'cicd',
  cicdpipelines: 'cicd',
  continuousintegration: 'cicd',
  html5: 'html',
  css3: 'css',
  tailwindcss: 'tailwind',
  scss: 'sass',
  reactnativejs: 'reactnative',
  vue3: 'vue',
  angular2: 'angular',
  ml: 'machinelearning',
  nlp: 'naturallanguageprocessing',
  uxui: 'uiux',
  uxdesign: 'ux',
  uidesign: 'ui',
  msexcel: 'excel',
  microsoftexcel: 'excel',
  microsoftpowerbi: 'powerbi',
  microsoftword: 'word',
  msword: 'word',
  microsoftoffice: 'office',
  msoffice: 'office',
  googleanalytics4: 'googleanalytics',
  ga4: 'googleanalytics',
}

// Trailing words that only say what kind of thing a skill is: "Salesforce CRM" is Salesforce, "Mediterranean
// cooking" is "Mediterranean cuisine". Never a word that changes the skill ("React Native" is not React).
const FILLER = new Set(['crm', 'software', 'platform', 'tool', 'tools', 'skill', 'skills', 'cuisine', 'cooking', 'framework', 'library'])

/**
 * The code canonical form of a skill name: accent- and case-insensitive, without trailing filler words, spaces, dots,
 * hyphens and slashes (C++, C# and F# keep their signs), without a trailing "js" (React js, Node.js), then the aliases.
 */
export function skillCanon(name) {
  const words = searchText(name).replace(/&/g, ' and ').split(/[^\p{L}\p{N}+#]+/u).filter(Boolean)
  while (words.length > 1 && FILLER.has(words.at(-1))) words.pop()
  let compact = words.join('')
  if (compact.length >= 4 && compact.endsWith('js')) compact = compact.slice(0, -2)
  return ALIASES[compact] ?? compact
}

/** Every canonical form a stored skill answers to: its typed name's and, when saved with one, its standard name's. */
const canonsOf = (skill) => [...new Set([skillCanon(skill.name), skill.standard && skillCanon(skill.standard)].filter(Boolean))]

/** One id per skill, for grouping skills of several jobs or people (the standard name first). */
export const skillId = (skill) => skillCanon(skill.standard || skill.name)

/** The skill as embedded and shown to OpenAI: the typed name, with the standard name when it says something else. */
export const skillLabel = (skill) => (skill.standard && skillCanon(skill.standard) !== skillCanon(skill.name) ? `${skill.name} (${skill.standard})` : skill.name)

/** The skills of a person, job or course as a lookup: `has(skill)` is true when any form of `skill` is listed. */
export function skillSet(skills) {
  const canons = new Set((skills ?? []).flatMap(canonsOf))
  return { has: (skill) => canonsOf(skill).some((canon) => canons.has(canon)) }
}

/** Names → [{ name, key }], refusing a case-insensitive duplicate on `field`. */
export function skillEntries(names, field) {
  const keys = names.map(skillKey)
  const duplicate = names.find((name, index) => keys.indexOf(keys[index]) !== index)
  if (duplicate) throw fieldError({ [field]: 'duplicate' }, { skill: duplicate })
  return names.map((name, index) => ({ name, key: keys[index] }))
}

/** M-052: `skills` are the candidate's [{ name, standard }]. Names are the job's; `missing` lists the required skills not matched. */
export function skillOverlap(skills, job) {
  const listed = skillSet(skills)
  const all = [...job.requiredSkills, ...job.preferredSkills]
  return {
    matched: all.filter((skill) => listed.has(skill)).map((skill) => skill.name),
    missing: job.requiredSkills.filter((skill) => !listed.has(skill)).map((skill) => skill.name),
    requiredMatched: job.requiredSkills.filter((skill) => listed.has(skill)).length,
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
