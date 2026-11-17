import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import OpenAI from 'openai'
import { config } from '../config/env.js'
import { LIMITS } from '../config/limits.js'
import { AiCache, AiUsage } from '../modules/ai/ai.model.js'
import { AppConfig } from '../modules/payments/payments.model.js'
import { AppError } from './errors.js'
import { searchText } from './skills.js'
import { budgetReached, creditCost, dailyCap, nextUtcDay, recordUsage, takeBurst, takeSkillNames, usageSettings, utcDay } from './usage.js'

/*
 * The OpenAI service (§2.9). Models follow U4: `fast` (OPENAI_FAST_MODEL) and `main` (OPENAI_MODEL); embeddings use
 * OPENAI_EMBEDDING_MODEL. Every failure becomes AI_UNAVAILABLE, and the key is never logged. API tests install a
 * stub client (test/setup.js), so they never call OpenAI; the e2e server uses the real one. The stub names its own
 * models, and the model is part of every embedding hash and cache key, so the test database's stub output is never
 * reused by the real server (both use eujobs_test).
 */
const MODELS = { fast: () => config.openai.fastModel, main: () => config.openai.model, embedding: () => config.openai.embeddingModel }
const modelName = (kind) => client?.models?.[kind] ?? MODELS[kind]()
const A = LIMITS.ai

let client = null
let failNext = false

/** Tests swap in a stub client; no argument restores the real one. */
export function setAiClient(fake) {
  client = fake ?? null
}

const openai = () => (client ??= new OpenAI({ apiKey: config.openai.apiKey, timeout: 60_000, maxRetries: 1 }))

/** /_test/ai/fail-next: the next OpenAI call fails. */
export function failNextCall() {
  failNext = true
}

/** AppConfig('ai') keeps the time of the last success and the last failure for the admin AI status. */
const noteStatus = (field) => AppConfig.updateOne({ key: 'ai' }, { $set: { [`value.${field}`]: new Date() } }, { upsert: true })

/** The tokens (or, for duration-billed transcription, the seconds) one answer reports. */
function usageOf(result) {
  const usage = result?.usage ?? {}
  if (usage.type === 'duration') return { seconds: usage.seconds ?? 0 }
  return { inputTokens: usage.input_tokens ?? usage.prompt_tokens ?? 0, outputTokens: usage.output_tokens ?? 0 }
}

/**
 * One OpenAI request, counted for the admin's Usage tab (owner 2026-11-17) as `kind` of `model` for `userId`. With
 * the OpenAI budget used up, nothing is sent: AI_PAUSED until the next month or a higher budget.
 */
async function call(run, { kind, model, userId = null }) {
  if (await budgetReached('openai')) throw new AppError('AI_PAUSED', { params: { resetAt: nextMonth() } })
  try {
    if (failNext) {
      failNext = false
      throw new Error('fail-next')
    }
    const result = await run(openai())
    await noteStatus('lastSuccessAt')
    await recordUsage({ provider: 'openai', model, kind, userId, ...usageOf(result) })
    return result
  } catch (error) {
    console.error(`OpenAI request failed: ${error.status ?? error.name}`)
    await noteStatus('lastErrorAt')
    throw new AppError('AI_UNAVAILABLE')
  }
}

function nextMonth(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString()
}

export async function aiStatus() {
  const status = (await AppConfig.findOne({ key: 'ai' }))?.value ?? {}
  return {
    paused: await budgetReached('openai'),
    models: { fast: config.openai.fastModel, main: config.openai.model, embedding: config.openai.embeddingModel, transcribe: config.openai.transcribeModel },
    lastSuccessAt: status.lastSuccessAt ?? null,
    lastErrorAt: status.lastErrorAt ?? null,
  }
}

/* ---------- embeddings (U6) ---------- */

export const embeddingModel = () => modelName('embedding')

/** One vector per text, as Float32Array; each input is cut to about 8,000 tokens. */
export async function embed(texts) {
  const model = embeddingModel()
  const response = await call((ai) => ai.embeddings.create({ model, input: texts.map((text) => text.slice(0, A.embeddingMaxChars)) }), { kind: 'embedding', model })
  return response.data.sort((a, b) => a.index - b.index).map((item) => Float32Array.from(item.embedding))
}

export const toBuffer = (vector) => Buffer.from(vector.buffer, vector.byteOffset, vector.byteLength)
export const toVector = (buffer) => new Float32Array(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength))

export function cosine(a, b) {
  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  return normA && normB ? dot / Math.sqrt(normA * normB) : 0
}

/* ---------- standard skill names (lib/skills.js) ---------- */

const SKILL_NAMES_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: { type: 'object', properties: { input: { type: 'string' }, standard: { type: 'string' } }, required: ['input', 'standard'], additionalProperties: false },
    },
  },
  required: ['items'],
  additionalProperties: false,
}

const SKILL_NAMES_INSTRUCTIONS = `You normalise skill names typed by candidates and recruiters on a European job platform
for every profession: healthcare, trades, hospitality, logistics, finance, sales, education, law, creative work,
engineering and more. Inputs may be in any language, misspelt, abbreviated or oddly spaced.
For each input, return the most widely used English standard name of the same skill, qualification, tool or method:
"postgrace sql" -> "PostgreSQL", "react js" -> "React", "k8s" -> "Kubernetes", "ms excel" -> "Microsoft Excel",
"Comptabilité" -> "Accounting", "Krankenpflege" -> "Nursing", "carretillero" -> "Forklift Operation",
"cpr" -> "CPR", "haccp" -> "HACCP", "customer servise" -> "Customer Service", "ux reserch" -> "UX Research".
Keep the meaning exact: never broaden, narrow or swap a skill for a related one ("React Native" stays "React Native",
"Java" never becomes "JavaScript", "SQL" never becomes "PostgreSQL", "Pastry" never becomes "Cooking").
If an input is not a recognisable skill or you are unsure, return it unchanged. Return one item per input, with
"input" copied exactly.`

/**
 * Sets `standard` on each skill ({ name }): OpenAI's English standard name, so a typo, synonym or other language still
 * matches (lib/skills.js) and embeds well. Cached per name; skills that already have one are skipped. When OpenAI
 * fails the skills stay without `standard` and match on the code form, and the next save asks again. Never blocks a
 * save for long. The names a candidate or recruiter (`user`) sends count toward their daily skill-name cap
 * (2026-11-17); past it the skills are saved without a standard name.
 */
export async function addStandardNames(skills, user = null) {
  const pending = skills.filter((skill) => !skill.standard)
  if (!pending.length) return
  // The main model: every name is asked once and then cached, so accuracy matters more than cost here.
  const model = modelName('main')
  const keyOf = (name) => hashOf([model, searchText(name)])
  const hits = new Map((await AiCache.find({ kind: 'skill_name', key: { $in: pending.map((skill) => keyOf(skill.name)) }, language: 'en' })).map((hit) => [hit.key, hit.output.standard]))
  const misses = [...new Set(pending.filter((skill) => !hits.has(keyOf(skill.name))).map((skill) => skill.name))]
  const capped = user && user.role !== 'admin'
  if (misses.length && (!capped || (await takeSkillNames(user._id, misses.length)))) {
    try {
      const response = await call((ai) =>
        ai.responses.create(
          {
            model,
            reasoning: { effort: 'low' },
            instructions: SKILL_NAMES_INSTRUCTIONS,
            input: JSON.stringify(misses),
            text: { format: { type: 'json_schema', name: 'skill_names', schema: SKILL_NAMES_SCHEMA, strict: true } },
          },
          // OpenAI's gateway refuses a connection now and then (503); two quick retries ride over it.
          { timeout: A.skillNamesTimeoutMs, maxRetries: 2 },
        ),
        { kind: 'skill_name', model, userId: user?._id },
      )
      // Only answers for the names asked about count; a name the model skipped keeps its own form.
      const answers = new Map(JSON.parse(response.output_text).items.map((item) => [item.input, item.standard.trim().slice(0, 60)]))
      const rows = misses.map((name) => ({ name, standard: answers.get(name) || name }))
      await AiCache.bulkWrite(rows.map(({ name, standard }) => ({ updateOne: { filter: { kind: 'skill_name', key: keyOf(name), language: 'en' }, update: { output: { standard }, model }, upsert: true } })))
      for (const { name, standard } of rows) hits.set(keyOf(name), standard)
    } catch {
      // AI_UNAVAILABLE is already logged; the code form still matches.
    }
  }
  for (const skill of pending) {
    const standard = hits.get(keyOf(skill.name))
    if (standard) skill.standard = standard
  }
}

/* ---------- transcription (M-181, M-182) ---------- */

export const TRANSCRIBE_FALLBACK_MODEL = 'whisper-1'

/** The text of an audio file: OPENAI_TRANSCRIBE_MODEL first, then whisper-1 when that model fails. */
export async function transcribe(path, user = null) {
  const run = (model) => call((ai) => ai.audio.transcriptions.create({ model, file: createReadStream(path) }), { kind: 'transcription', model, userId: user?._id })
  const primary = client?.models?.transcribe ?? config.openai.transcribeModel
  try {
    return (await run(primary)).text
  } catch {
    return (await run(TRANSCRIBE_FALLBACK_MODEL)).text
  }
}

/* ---------- generations (§2.9, OD13, U3) ---------- */

export const hashOf = (value) => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex')

const languageName = (language) => new Intl.DisplayNames(['en'], { type: 'language' }).of(language)

/** AI_DAILY_LIMIT when today's credits left are fewer than `cost` (with the limit, what is left and the cost). */
async function dailyLimitError(user, limit, cost) {
  const used = (await AiUsage.findOne({ userId: user._id, day: utcDay() }))?.count ?? 0
  return new AppError('AI_DAILY_LIMIT', { params: { resetAt: nextUtcDay().toISOString(), limit, remaining: Math.max(limit - used, 0), cost } })
}

/**
 * Before paid work that happens ahead of the text itself (the voice profile's transcription): refuses at once when
 * today's credits cannot cover `kind`, so nothing is spent on a request that would be refused anyway.
 */
export async function assertCredits(user, kind) {
  if (user.role === 'admin') return
  const [limit, cost] = await Promise.all([dailyCap(user), creditCost(kind)])
  const used = (await AiUsage.findOne({ userId: user._id, day: utcDay() }))?.count ?? 0
  if (used + cost > limit) throw await dailyLimitError(user, limit, cost)
}

/**
 * Reserves the kind's credits (weighted, owner 2026-11-17: 1 unless the admin's settings say more) of today's cap
 * atomically (the user's plan and billing interval, lib/usage.js), and one of the kind's own daily limit when it has
 * one (CV drafts, CV to profile); at a limit the upsert collides with the existing row, and the row tells which limit
 * it was. The burst limit is checked first. Returns what release() gives back.
 */
async function reserve(user, kind) {
  await takeBurst(user._id)
  const [limit, cost, settings] = await Promise.all([dailyCap(user), creditCost(kind), usageSettings()])
  // A cost above the whole day's credits could otherwise slip through on the day's first (inserted) row.
  if (cost > limit) throw await dailyLimitError(user, limit, cost)
  const featureLimit = settings.featureLimits?.[kind] ?? null
  const feature = `features.${kind}`
  const filter = { userId: user._id, day: utcDay(), count: { $not: { $gt: limit - cost } }, ...(featureLimit && { [feature]: { $not: { $gte: featureLimit } } }) }
  try {
    await AiUsage.updateOne(filter, { $inc: { count: cost, ...(featureLimit && { [feature]: 1 }) } }, { upsert: true })
  } catch (error) {
    if (error.code !== 11000) throw error
    const used = (await AiUsage.findOne({ userId: user._id, day: utcDay() }))?.features?.get(kind) ?? 0
    if (featureLimit && used >= featureLimit) throw new AppError('AI_FEATURE_LIMIT', { params: { resetAt: nextUtcDay().toISOString(), limit: featureLimit, feature: kind } })
    throw await dailyLimitError(user, limit, cost)
  }
  return { cost, featureLimit }
}

const release = (userId, kind, { cost, featureLimit }) =>
  AiUsage.updateOne({ userId, day: utcDay() }, { $inc: { count: -cost, ...(featureLimit && { [`features.${kind}`]: -1 }) } })

/**
 * A structured answer from OpenAI in `language` (S, M-057). `cacheKey` (inputs plus the entity version, hashed) makes
 * the answer reusable per language; null means not cached. A miss counts toward the user's daily cap unless the user
 * is an admin; `regenerate` (admin Regenerate) replaces the cached answer without counting. `subjectId` is the candidate the
 * answer is about, so erasure can delete it (M-188).
 */
export async function generate({ kind, user, language, cacheKey = null, subjectId = null, model = 'fast', instructions, input, schema, regenerate = false }) {
  const key = cacheKey && hashOf([modelName(model), cacheKey])
  if (key && !regenerate) {
    const hit = await AiCache.findOne({ kind, key, language })
    if (hit) return hit.output
  }
  const counted = user.role !== 'admin' && !regenerate
  const reserved = counted ? await reserve(user, kind) : null
  let output
  try {
    const response = await call((ai) =>
      ai.responses.create({
        model: modelName(model),
        reasoning: { effort: 'low' },
        instructions: `${instructions}\nWrite every text value in ${languageName(language)}.`,
        input: typeof input === 'string' ? input : JSON.stringify(input),
        text: { format: { type: 'json_schema', name: kind, schema, strict: true } },
      }),
      { kind, model: modelName(model), userId: user._id },
    )
    output = JSON.parse(response.output_text)
  } catch (error) {
    if (counted) await release(user._id, kind, reserved)
    throw error instanceof AppError ? error : new AppError('AI_UNAVAILABLE')
  }
  if (key) await AiCache.updateOne({ kind, key, language }, { output, model: modelName(model), subjectId }, { upsert: true })
  return output
}

/**
 * Once, at startup: cache rows written before `subjectId` existed cannot be found by an erasure (M-188), so the
 * rows of kinds that can be about a candidate are dropped (they are made again on the next open); the others get
 * `subjectId: null`.
 */
export async function migrateAiCacheSubjects() {
  const missing = { subjectId: { $exists: false } }
  await AiCache.deleteMany({ ...missing, kind: { $in: ['match_explanation', 'insights', 'profile_summary', 'cv_snapshot', 'translation'] } })
  await AiCache.updateMany(missing, { $set: { subjectId: null } })
}
