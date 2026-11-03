import { login } from './recruiters.js'
import { api, db } from './testApi.js'

/*
 * Phase 9 helpers: match results and embeddings read straight from the test database, so a scenario compares what
 * the screens show with an independent read (the server never sends a recruiter or Free candidate a score).
 */
export const oid = (value) => value?.$oid ?? value
export const toDate = (value) => new Date(value?.$date ?? value)

/** The match results of one job or one candidate, as a map from the other side's id to the result. */
export async function resultsBy({ jobId, candidateId }) {
  const filter = jobId ? { jobId: { $oid: jobId } } : { candidateId: { $oid: candidateId } }
  const other = jobId ? 'candidateId' : 'jobId'
  return new Map((await db('matchresults', 'find', { filter })).map((result) => [oid(result[other]), result]))
}

export const embeddingOf = async (ownerId) => (await db('embeddings', 'find', { filter: { ownerId: { $oid: ownerId } } }))[0] ?? null

/** "80%" as the English screens write a score. */
export const percent = (score) => `${score}%`

/** Sarah (Acme Studio, United Kingdom view): her token and her newest published job (the default match job, P4-D10). */
export async function sarah(ctx) {
  const token = await login(ctx.seedCredentials.email('sarah'), 'recruiter', ctx.seedCredentials.password)
  const { items } = (await api('/recruiter/jobs', { token })).body
  const job = items.filter((item) => item.status === 'published').sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))[0]
  return { token, job }
}

/**
 * M-051, U7: the job's relevant count, recomputed from its market population (Find candidates in the job's country,
 * Remote for a remote job) and the stored scores. The recruiter's header country is restored afterwards.
 */
export async function expectedRelevant(token, job) {
  const { pickerCountry } = (await api('/me', { token })).body
  await api('/me', { method: 'PATCH', token, body: { pickerCountry: job.country } })
  const population = (await api('/recruiter/candidates', { token })).body.items
  await api('/me', { method: 'PATCH', token, body: { pickerCountry } })
  const results = await resultsBy({ jobId: job.id })
  const required = new Set(job.requiredSkills.map((skill) => skill.toLowerCase()))
  return population.filter((person) => {
    const result = results.get(person.id)
    return result ? Boolean(result.label) : person.skills.some((skill) => required.has(skill.toLowerCase()))
  }).length
}

/** Every key of a JSON value, at any depth. */
export function keysOf(value, found = new Set()) {
  if (Array.isArray(value)) value.forEach((item) => keysOf(item, found))
  else if (value && typeof value === 'object') for (const [key, item] of Object.entries(value)) keysOf(item, found.add(key))
  return found
}

/** Runs `work` with the user's header country set to `country`, then restores it. */
export async function inCountry(token, country, work) {
  const { pickerCountry } = (await api('/me', { token })).body
  await api('/me', { method: 'PATCH', token, body: { pickerCountry: country } })
  try {
    return await work()
  } finally {
    await api('/me', { method: 'PATCH', token, body: { pickerCountry } })
  }
}

export const tick = (now = new Date()) => api('/_test/scheduler/tick', { method: 'POST', body: { now: now.toISOString() } })
