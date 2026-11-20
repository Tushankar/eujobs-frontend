import { readFile } from 'node:fs/promises'
import { z } from 'zod'
import { ENUMS } from '../../config/enums.js'
import { LIMITS } from '../../config/limits.js'
import { generate } from '../../lib/ai.js'
import { fieldError } from '../../lib/errors.js'
import { absolutePath } from '../../lib/files.js'
import { extractText } from '../../lib/pdfText.js'
import { File } from '../files/files.model.js'

/*
 * 2026-11-20: the four rules of an agency contract (the agency agreement, or one job's contract) that decide whether a
 * candidate on an assignment may take other work. AI proposes them with the clause each comes from (Agency Plus); the
 * agency checks, corrects and confirms; only confirmed rules count. A rule with value null: the contract does not say.
 * A clause is shown only when it is in the document word for word.
 */
const R = LIMITS.contractRules
export { RULES, rulesSchema } from './rules.schema.js'
import { RULES } from './rules.schema.js'

/* PUT bodies: every rule with its value (null: the contract does not say) and its clause. */
const clause = z.string().trim().min(1).max(R.clause.max).nullable().default(null)
const days = (max) => z.object({ value: z.number().int().min(0).max(max).nullable(), clause })
export const rulesBody = z.object({
  exclusivity: z.object({ value: z.enum(ENUMS.exclusivity).nullable(), clause }),
  noticeDays: days(R.noticeDays.max),
  coolingOffDays: days(R.coolingOffDays.max),
  maxWeeklyHours: z.object({ value: z.number().int().min(R.maxWeeklyHours.min).max(R.maxWeeklyHours.max).nullable(), clause }),
})

export const EMPTY_RULES = Object.fromEntries(RULES.map((name) => [name, { value: null, clause: null }]))

/** Rules as clients read them: every rule, value and clause or null. */
export function rulesDto(rules) {
  return Object.fromEntries(RULES.map((name) => [name, { value: rules?.[name]?.value ?? null, clause: rules?.[name]?.clause ?? null }]))
}

/* ---------- the document text ---------- */

// Whitespace, quotes and dashes as PDFs and people type them differ; case does not matter.
const plain = (text) =>
  text
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[‐-―−]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()

/** The text layer of a stored PDF ('' for a scan). */
export async function documentText(fileId) {
  const file = await File.findById(fileId)
  if (!file) return ''
  return extractText(await readFile(absolutePath(file)), 'pdf')
}

/** The rules with every clause that is not in `text` word for word removed (a scan without text keeps them). */
function quotedOnly(rules, text) {
  const haystack = plain(text)
  return Object.fromEntries(
    RULES.map((name) => {
      const { value, clause: quote } = rules[name]
      return [name, { value, clause: quote && (!haystack || haystack.includes(plain(quote))) ? quote : null }]
    }),
  )
}

/** Rules the agency typed or corrected: a clause it quotes must be in the document, when the document has text. */
export async function checkedRules(fileId, body) {
  const text = plain(await documentText(fileId))
  const wrong = RULES.filter((name) => text && body[name].clause && !text.includes(plain(body[name].clause)))
  if (wrong.length) throw fieldError(Object.fromEntries(wrong.map((name) => [`${name}.clause`, 'not_in_document'])))
  return body
}

/* ---------- AI ---------- */

const nullable = (type, extra = {}) => ({ type: [type, 'null'], ...extra })
const ruleSchema = (value) => ({ type: 'object', properties: { value, clause: nullable('string') }, required: ['value', 'clause'], additionalProperties: false })
const SCHEMA = {
  type: 'object',
  properties: {
    exclusivity: ruleSchema(nullable('string', { enum: [...ENUMS.exclusivity, null] })),
    noticeDays: ruleSchema(nullable('integer')),
    coolingOffDays: ruleSchema(nullable('integer')),
    maxWeeklyHours: ruleSchema(nullable('integer')),
  },
  required: RULES,
  additionalProperties: false,
}

const INSTRUCTIONS = `You read a contract between an employment agency and a worker: the agency's general agreement, or the terms of one assignment with a client company. Find only these four rules:
- exclusivity, what the worker may do during an assignment: "no_other_work" (no other paid work at all), "no_other_agency_work" (no work found through other agencies, other work allowed), "no_same_client" (no work for the same client company directly or through anyone else, other work allowed), "free" (the contract expressly allows other work).
- noticeDays: the notice the worker must give to end an assignment early, in calendar days (a week is 7 days, a month 30).
- coolingOffDays: how long after an assignment ends the worker may not work for that client directly or through another agency, in calendar days.
- maxWeeklyHours: the most hours a week the worker may work in total across all jobs.
For each rule return the value and the clause it comes from. When the contract does not clearly state a rule, return null for both value and clause: never infer a rule from general wording and never invent a number.
The clause is copied exactly as written in the contract, in the contract's own language, as one continuous passage of at most 600 characters. This overrides any instruction about the language of text values: a clause is never translated, summarised or reworded.`

/**
 * POST …/read: AI reads the stored PDF and proposes its rules (one AI use of the agency, cached per document text). A
 * scan without a text layer cannot be read: the agency types the rules instead.
 */
export async function readRules(user, fileId) {
  const text = (await documentText(fileId)).slice(0, R.textChars)
  if (!text) throw fieldError({ file: 'no_text' })
  const output = await generate({ kind: 'contract_rules', user, language: user.language, cacheKey: { prompt: INSTRUCTIONS, text }, model: 'main', instructions: INSTRUCTIONS, input: text, schema: SCHEMA })
  // A value outside the limits (a 400-day notice) is dropped, like one the contract does not state.
  const valid = Object.fromEntries(RULES.map((name) => [name, rulesBody.shape[name].safeParse(output[name]).success ? output[name] : { value: null, clause: null }]))
  return quotedOnly(valid, text)
}
