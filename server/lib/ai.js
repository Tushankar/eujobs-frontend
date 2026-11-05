import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import OpenAI from 'openai'
import { config } from '../config/env.js'
import { LIMITS } from '../config/limits.js'
import { AiCache, AiUsage } from '../modules/ai/ai.model.js'
import { AppConfig } from '../modules/payments/payments.model.js'
import { AppError } from './errors.js'
import { searchText } from './skills.js'

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

async function call(run) {
  try {
    if (failNext) {
      failNext = false
      throw new Error('fail-next')
    }
    const result = await run(openai())
    await noteStatus('lastSuccessAt')
    return result
  } catch (error) {
    console.error(`OpenAI request failed: ${error.status ?? error.name}`)
    await noteStatus('lastErrorAt')
    throw new AppError('AI_UNAVAILABLE')
  }
}

export async function aiStatus() {
  const status = (await AppConfig.findOne({ key: 'ai' }))?.value ?? {}
  return {
    models: { fast: config.openai.fastModel, main: config.openai.model, embedding: config.openai.embeddingModel, transcribe: config.openai.transcribeModel },
    lastSuccessAt: status.lastSuccessAt ?? null,
    lastErrorAt: status.lastErrorAt ?? null,
  }
}

/* ---------- embeddings (U6) ---------- */

export const embeddingModel = () => modelName('embedding')

/** One vector per text, as Float32Array; each input is cut to about 8,000 tokens. */
export async function embed(texts) {
  const response = await call((ai) => ai.embeddings.create({ model: embeddingModel(), input: texts.map((text) => text.slice(0, A.embeddingMaxChars)) }))
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
 * fails the skills stay without `standard` and match on the code form, and the next save asks again. Never blocks a save for long, never counts toward a cap.
 */
export async function addStandardNames(skills) {
  const pending = skills.filter((skill) => !skill.standard)
  if (!pending.length) return
  // The main model: every name is asked once and then cached, so accuracy matters more than cost here.
  const model = modelName('main')
  const keyOf = (name) => hashOf([model, searchText(name)])
  const hits = new Map((await AiCache.find({ kind: 'skill_name', key: { $in: pending.map((skill) => keyOf(skill.name)) }, language: 'en' })).map((hit) => [hit.key, hit.output.standard]))
  const misses = [...new Set(pending.filter((skill) => !hits.has(keyOf(skill.name))).map((skill) => skill.name))]
  if (misses.length) {
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
export async function transcribe(path) {
  const run = (model) => call((ai) => ai.audio.transcriptions.create({ model, file: createReadStream(path) }))
  const primary = client?.models?.transcribe ?? config.openai.transcribeModel
  try {
    return (await run(primary)).text
  } catch {
    return (await run(TRANSCRIBE_FALLBACK_MODEL)).text
  }
}

/* ---------- generations (§2.9, OD13, U3) ---------- */

export const hashOf = (value) => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex')

const utcDay = (now = new Date()) => now.toISOString().slice(0, 10)
const languageName = (language) => new Intl.DisplayNames(['en'], { type: 'language' }).of(language)

/** Reserves one generation of today's cap atomically; at the cap the upsert collides with the existing row. */
async function reserve(userId) {
  try {
    await AiUsage.updateOne({ userId, day: utcDay(), count: { $lt: A.dailyGenerations } }, { $inc: { count: 1 } }, { upsert: true })
  } catch (error) {
    if (error.code !== 11000) throw error
    const resetAt = new Date(`${utcDay()}T00:00:00.000Z`)
    resetAt.setUTCDate(resetAt.getUTCDate() + 1)
    throw new AppError('AI_DAILY_LIMIT', { params: { resetAt: resetAt.toISOString() } })
  }
}

const release = (userId) => AiUsage.updateOne({ userId, day: utcDay() }, { $inc: { count: -1 } })

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
  if (counted) await reserve(user._id)
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
    )
    output = JSON.parse(response.output_text)
  } catch (error) {
    if (counted) await release(user._id)
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
