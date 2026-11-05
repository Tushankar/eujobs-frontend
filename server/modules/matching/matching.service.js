import { dailyJobs, scheduleTask, taskHandlers } from '../../jobs/scheduler.js'
import { cosine, embed, embeddingModel, hashOf, toBuffer, toVector } from '../../lib/ai.js'
import { t } from '../../lib/i18n.js'
import { skillLabel, skillOverlap } from '../../lib/skills.js'
import { CandidateProfile } from '../candidates/candidates.model.js'
import { CvVersion } from '../cv/cv.model.js'
import { marketCandidates } from '../discovery/discovery.population.js'
import { Job } from '../jobs/jobs.model.js'
import { User } from '../users/users.model.js'
import { Embedding, MatchingPolicy, MatchResult } from './matching.model.js'
import { scoreMatch } from './matching.score.js'

/*
 * Embeddings, scores and relevance (M-047 … M-051, U5 … U7). Candidates with matching consent are embedded, Free
 * included (only the display is gated); jobs once they leave draft. Changes schedule a `matching.recompute` task,
 * which re-embeds a changed text, rescores the pairs and refreshes the relevant counts. Pairs without both vectors
 * have no result and use the Phase 4 skill fallback (M-051).
 */
const EMBED_BATCH = 16
const english = new Intl.DisplayNames(['en'], { type: 'language' })

/* ---------- texts (U6) ---------- */

export function candidateText(profile, cvText) {
  return [
    profile.headline,
    profile.about,
    profile.skills.map(skillLabel).join(', '),
    ...profile.workHistory.map((entry) => [entry.title, entry.employer, entry.description].filter(Boolean).join(' · ')),
    ...profile.education.map((entry) => [entry.degree, entry.institution].filter(Boolean).join(' · ')),
    cvText,
  ]
    .filter(Boolean)
    .join('\n')
}

export function jobText(job) {
  return [
    job.title,
    job.brief,
    ...job.responsibilities,
    [...job.requiredSkills, ...job.preferredSkills].map(skillLabel).join(', '),
    job.level && t('en', `labels.jobLevel.${job.level}`),
    job.requiredLanguages.map(({ code, minLevel }) => `${english.of(code)} ${minLevel}`).join(', '),
  ]
    .filter(Boolean)
    .join('\n')
}

/* ---------- who is matched ---------- */

/** Candidates with matching consent and a profile, as [{ user, profile, text }]; `ids` narrows them. */
async function eligibleCandidates(ids) {
  const users = await User.find({ role: 'candidate', 'privacy.matchingConsent': true, ...(ids && { _id: { $in: ids } }) })
  const profiles = await CandidateProfile.find({ userId: { $in: users.map((user) => user._id) } })
  const cvs = new Map(
    (await CvVersion.find({ _id: { $in: profiles.map((profile) => profile.liveCvVersionId).filter(Boolean) } }, 'extractedText')).map((cv) => [String(cv._id), cv.extractedText]),
  )
  const byUser = new Map(users.map((user) => [String(user._id), user]))
  return profiles
    .map((profile) => ({ user: byUser.get(String(profile.userId)), profile, text: candidateText(profile, cvs.get(String(profile.liveCvVersionId))) }))
    .filter((entry) => entry.text)
}

const eligibleJobs = (ids) => Job.find({ status: { $ne: 'draft' }, ...(ids && { _id: { $in: ids } }) })

/* ---------- embeddings ---------- */

/**
 * Embeds the owners whose text changed. A vector already stored for the same model and text is reused (seed:demo
 * recreates its owners with new ids), so only new texts reach OpenAI.
 */
export async function ensureEmbeddings(owners) {
  const model = embeddingModel()
  const hashed = owners.map((owner) => ({ ...owner, sourceHash: hashOf(`${model}\n${owner.text}`) }))
  const current = new Map((await Embedding.find({ ownerId: { $in: owners.map((owner) => owner.ownerId) } }, 'ownerId sourceHash')).map((item) => [String(item.ownerId), item.sourceHash]))
  const stale = hashed.filter((owner) => current.get(String(owner.ownerId)) !== owner.sourceHash)
  if (!stale.length) return
  const vectors = new Map((await Embedding.find({ sourceHash: { $in: stale.map((owner) => owner.sourceHash) } }, 'sourceHash dims vector')).map((item) => [item.sourceHash, item]))
  const missing = [...new Map(stale.filter((owner) => !vectors.has(owner.sourceHash)).map((owner) => [owner.sourceHash, owner])).values()]
  for (let start = 0; start < missing.length; start += EMBED_BATCH) {
    const batch = missing.slice(start, start + EMBED_BATCH)
    const embedded = await embed(batch.map((owner) => owner.text))
    batch.forEach((owner, index) => vectors.set(owner.sourceHash, { dims: embedded[index].length, vector: toBuffer(embedded[index]) }))
  }
  await Embedding.bulkWrite(
    stale.map(({ ownerType, ownerId, sourceHash }) => {
      const { dims, vector } = vectors.get(sourceHash)
      return { updateOne: { filter: { ownerType, ownerId }, update: { $set: { model, dims, vector, sourceHash } }, upsert: true } }
    }),
  )
}

const candidateOwners = (entries) => entries.map(({ user, text }) => ({ ownerType: 'candidate', ownerId: user._id, text }))
const jobOwners = (jobs) => jobs.map((job) => ({ ownerType: 'job', ownerId: job._id, text: jobText(job) }))

/* ---------- scores ---------- */

export const activePolicy = () => MatchingPolicy.findOne({ status: 'active' })

/** Scores every candidate × job pair that has both vectors under the active policy version. */
async function scorePairs(candidates, jobs) {
  const policy = await activePolicy()
  if (!policy || !candidates.length || !jobs.length) return
  const ids = [...candidates.map(({ user }) => user._id), ...jobs.map((job) => job._id)]
  const vectors = new Map((await Embedding.find({ ownerId: { $in: ids } }, 'ownerId vector')).map((item) => [String(item.ownerId), toVector(item.vector)]))
  const now = new Date()
  const operations = []
  for (const { user, profile } of candidates) {
    for (const job of jobs) {
      const filter = { jobId: job._id, candidateId: user._id }
      const [a, b] = [vectors.get(String(user._id)), vectors.get(String(job._id))]
      if (!a || !b) {
        operations.push({ deleteOne: { filter } })
        continue
      }
      const result = scoreMatch({ cos: cosine(a, b), profile, job, policy })
      operations.push({ updateOne: { filter, update: { $set: { ...result, policyVersionId: policy.versionId, computedAt: now } }, upsert: true } })
    }
  }
  await MatchResult.bulkWrite(operations)
}

/* ---------- relevance (M-051, U7, C7) ---------- */

/** A pair is relevant with a score ≥ Good; without a result (no vector), with at least 1 required skill. */
export const relevantPair = (job, profile, result) => (result ? result.label !== null : skillOverlap(profile.skills, job).requiredMatched > 0)

/** Results of one candidate (`candidateId`) or one job (`jobId`), keyed by the other side's id. */
export async function resultsBy(filter, ids) {
  const [own, other] = filter.jobId ? ['jobId', 'candidateId'] : ['candidateId', 'jobId']
  const results = await MatchResult.find({ [own]: filter[own], ...(ids && { [other]: { $in: ids } }) })
  return new Map(results.map((result) => [String(result[other]), result]))
}

/**
 * The relevant candidates of a job: its market population (M-054, M-055) with a score ≥ Good, best first; pairs
 * without a score follow by skill overlap. Returns [{ entry, result, overlap }].
 */
export async function relevantCandidates(job, population) {
  if (!job.country) return []
  population ??= await marketCandidates(job.country)
  const results = await resultsBy({ jobId: job._id })
  return population
    .map((entry) => ({ entry, result: results.get(String(entry.user._id)) ?? null, overlap: skillOverlap(entry.profile.skills, job) }))
    .filter(({ entry, result }) => relevantPair(job, entry.profile, result))
    .sort((a, b) => (b.result?.score ?? -1) - (a.result?.score ?? -1) || b.overlap.matched.length - a.overlap.matched.length)
}

/** Stores each job's relevant count. */
export async function refreshRelevantCounts(jobs) {
  const markets = new Map()
  for (const job of jobs) {
    if (job.country && !markets.has(job.country)) markets.set(job.country, await marketCandidates(job.country))
    const count = job.country ? (await relevantCandidates(job, markets.get(job.country))).length : 0
    job.relevantCount = count
    await Job.updateOne({ _id: job._id }, { relevantCount: count, relevantComputedAt: new Date() }, { timestamps: false })
  }
}

const openJobs = () => Job.find({ status: { $ne: 'closed' } })

/* ---------- recompute ---------- */

export async function recomputeCandidate(userId) {
  const [entry] = await eligibleCandidates([userId])
  if (entry) {
    await ensureEmbeddings(candidateOwners([entry]))
    await scorePairs([entry], await eligibleJobs())
  } else {
    // M-187: without consent (or without any profile text) the candidate leaves AI matching.
    await Embedding.deleteMany({ ownerType: 'candidate', ownerId: userId })
    await MatchResult.deleteMany({ candidateId: userId })
  }
  await refreshRelevantCounts(await openJobs())
}

export async function recomputeJob(jobId) {
  const [job] = await eligibleJobs([jobId])
  if (!job) return
  // A candidate whose own recompute has not run yet (or failed) is embedded here too; unchanged texts cost nothing.
  const candidates = await eligibleCandidates()
  await ensureEmbeddings([...jobOwners([job]), ...candidateOwners(candidates)])
  await scorePairs(candidates, [job])
  await refreshRelevantCounts([job])
}

/** Everything: after a policy change, nightly at 03:00 and at the startup catch-up (U7). */
export async function recomputeAll() {
  const [candidates, jobs] = await Promise.all([eligibleCandidates(), eligibleJobs()])
  await ensureEmbeddings([...candidateOwners(candidates), ...jobOwners(jobs)])
  // Only after the reuse above: vectors and results of anyone no longer matched (or deleted) go.
  const ownerIds = [...candidates.map(({ user }) => user._id), ...jobs.map((job) => job._id)]
  await Promise.all([
    Embedding.deleteMany({ ownerId: { $nin: ownerIds } }),
    MatchResult.deleteMany({ $or: [{ candidateId: { $nin: ownerIds } }, { jobId: { $nin: ownerIds } }] }),
  ])
  await scorePairs(candidates, jobs)
  await refreshRelevantCounts(await openJobs())
}

const RECOMPUTE = { candidate: recomputeCandidate, job: recomputeJob, all: recomputeAll }

/** M-048, M-051: runs on the next scheduler tick; repeated changes collapse into one pending task. */
export function scheduleRecompute(ownerType, ownerId) {
  return scheduleTask({
    type: 'matching.recompute',
    key: `matching:${ownerType}:${ownerId ?? 'all'}`,
    dueAt: new Date(),
    payload: { ownerType, ownerId: ownerId && String(ownerId) },
  })
}

taskHandlers['matching.recompute'] = ({ ownerType, ownerId }) => RECOMPUTE[ownerType](ownerId)

// U7: nightly at 03:00 server time, caught up at startup after 24 h (the scheduler's daily slots).
dailyJobs.push({ name: 'relevance-nightly', hour: 3, run: () => recomputeAll() })
