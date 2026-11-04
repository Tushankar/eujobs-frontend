import { LIMITS } from '../../config/limits.js'
import { generate } from '../../lib/ai.js'
import { actorFor, recordAudit } from '../../lib/audit.js'
import { AppError, fieldError } from '../../lib/errors.js'
import { ExplanationFeedback } from '../ai/ai.model.js'
import { photoUrls } from '../candidates/candidates.service.js'
import { Company } from '../companies/companies.model.js'
import { marketCandidates } from '../discovery/discovery.population.js'
import { Job } from '../jobs/jobs.model.js'
import { matchEvidence } from './matching.evidence.js'
import { MatchingPolicy, MatchingPolicyVersion } from './matching.model.js'
import { resultsBy, scheduleRecompute } from './matching.service.js'

/*
 * Admin AI & matching (M-048, M-049, M-068, A: admin §1.18, §1.19). Policies: create (a draft with every signal on),
 * rename, save signals (a new version; skills or experience must stay on, P9-Q4), activate (the previous active one
 * becomes a draft) and archive drafts. Saving or activating the active policy recomputes every score.
 */
const M = LIMITS.matching
const DEFAULTS = { signals: { skills: true, experience: true, location: true }, weights: M.weights, thresholds: M.thresholds }

const audit = (admin, type, policy) =>
  recordAudit({ type: `policy.${type}`, category: 'policy', actor: actorFor(admin), target: { type: 'matching_policy', id: policy._id }, params: { name: policy.name, version: policy.version } })

async function addVersion(policy, createdBy) {
  const version = await MatchingPolicyVersion.create({ policyId: policy._id, version: policy.version, signals: policy.signals, weights: policy.weights, thresholds: policy.thresholds, createdBy })
  policy.versionId = version._id
  await policy.save()
}

/** seed:catalog: the default policy v1, active, when no policy exists yet (§3.20). */
export async function ensureDefaultPolicy() {
  if (await MatchingPolicy.exists({})) return
  const name = 'Default evidence policy'
  const policy = new MatchingPolicy({ name, nameLower: name.toLowerCase(), description: 'Balanced evidence review for skills, experience and work preferences.', status: 'active', activatedAt: new Date(), ...DEFAULTS })
  await addVersion(policy)
}

async function policyDto(policy) {
  const versions = await MatchingPolicyVersion.find({ policyId: policy._id }).sort({ version: -1 })
  return {
    id: String(policy._id),
    name: policy.name,
    description: policy.description,
    status: policy.status,
    signals: policy.signals,
    version: policy.version,
    activatedAt: policy.activatedAt ?? null,
    updatedAt: policy.updatedAt,
    versions: versions.map((version) => ({ version: version.version, signals: version.signals, createdAt: version.createdAt })),
  }
}

export async function listPolicies() {
  const policies = await MatchingPolicy.find().sort({ createdAt: 1 })
  const items = await Promise.all(policies.map(policyDto))
  return { items, total: items.length, page: 1, pageSize: items.length }
}

async function ownPolicy(id, { editable = false } = {}) {
  const policy = await MatchingPolicy.findById(id)
  if (!policy) throw new AppError('NOT_FOUND')
  if (editable && policy.status === 'archived') throw new AppError('CONFLICT', { params: { status: policy.status } })
  return policy
}

async function assertUniqueName(name, exceptId) {
  if (await MatchingPolicy.exists({ nameLower: name.toLowerCase(), _id: { $ne: exceptId } })) throw fieldError({ name: 'taken' })
}

export async function createPolicy(admin, { name, description }) {
  await assertUniqueName(name)
  const policy = new MatchingPolicy({ name, nameLower: name.toLowerCase(), description, createdBy: admin._id, ...DEFAULTS })
  await addVersion(policy, admin._id)
  await audit(admin, 'created', policy)
  return policyDto(policy)
}

export async function updatePolicy(admin, id, { name, description }) {
  const policy = await ownPolicy(id, { editable: true })
  await assertUniqueName(name, policy._id)
  policy.set({ name, nameLower: name.toLowerCase(), description })
  await policy.save()
  await audit(admin, 'updated', policy)
  return policyDto(policy)
}

/** M-049, P9-Q4: a new version; location alone cannot score. */
export async function saveSignals(admin, id, signals) {
  if (!signals.skills && !signals.experience) throw fieldError({ signals: 'skills_or_experience' })
  const policy = await ownPolicy(id, { editable: true })
  policy.signals = signals
  policy.version += 1
  await addVersion(policy, admin._id)
  await audit(admin, 'saved', policy)
  if (policy.status === 'active') await scheduleRecompute('all')
  return policyDto(policy)
}

export async function activatePolicy(admin, id) {
  const policy = await ownPolicy(id, { editable: true })
  if (policy.status === 'active') throw new AppError('CONFLICT', { params: { status: policy.status } })
  await MatchingPolicy.updateMany({ status: 'active' }, { status: 'draft' })
  policy.set({ status: 'active', activatedAt: new Date() })
  await policy.save()
  await audit(admin, 'activated', policy)
  await scheduleRecompute('all')
  return policyDto(policy)
}

export async function archivePolicy(admin, id) {
  const policy = await ownPolicy(id)
  if (policy.status !== 'draft') throw new AppError('CONFLICT', { params: { status: policy.status } })
  policy.status = 'archived'
  await policy.save()
  await audit(admin, 'archived', policy)
  return policyDto(policy)
}

const SUGGESTION_SCHEMA = { type: 'object', properties: { description: { type: 'string' } }, required: ['description'], additionalProperties: false }

/** M-048, U4: an improved description from OPENAI_MODEL in the admin's language; never cached. */
export async function suggestDescription(admin, { name, description }) {
  const output = await generate({
    kind: 'policy_suggestion',
    user: admin,
    language: admin.language,
    model: 'main',
    instructions: [
      'You help an administrator of a European job platform describe a candidate-matching policy.',
      'Rewrite the description so it states which roles, markets or review situations the policy is for.',
      'Matching compares profile skills, experience and work preferences with a job as evidence; a person reviews every recommendation and protected characteristics are never inputs.',
      `Keep it under ${M.policyDescription.max - 20} characters, plain text, no lists, and do not invent facts about the platform.`,
    ].join('\n'),
    input: { policyName: name, currentDescription: description },
    schema: SUGGESTION_SCHEMA,
  })
  return { description: output.description.trim().slice(0, M.policyDescription.max) }
}

/* ---------- oversight (M-068) ---------- */

const jobRow = (job, companies) => ({ id: String(job._id), title: job.title, company: companies.get(String(job.companyId)) ?? null })

/**
 * A job picker (published jobs, newest first; default the newest), the top 4 of that job's market population by score
 * with the percentage (admins see %, C6), and the code evidence for the selected candidate (default the first).
 */
export async function oversight(admin, { jobId, candidateId }) {
  const jobs = await Job.find({ status: 'published' }).sort({ publishedAt: -1 })
  const companies = new Map((await Company.find({ _id: { $in: jobs.map((job) => job.companyId) } }, 'displayName')).map((company) => [String(company._id), company.displayName]))
  const job = jobId ? jobs.find((item) => String(item._id) === jobId) : jobs[0]
  if (jobId && !job) throw new AppError('NOT_FOUND')
  if (!job) return { jobs: [], job: null, candidates: [], selected: null }
  const results = await resultsBy({ jobId: job._id })
  const top = (await marketCandidates(job.country))
    .map((entry) => ({ entry, result: results.get(String(entry.user._id)) }))
    .filter(({ result }) => result)
    .sort((a, b) => b.result.score - a.result.score || a.entry.user.fullName.localeCompare(b.entry.user.fullName))
    .slice(0, M.oversightCandidates)
  const chosen = (candidateId && top.find(({ entry }) => String(entry.user._id) === candidateId)) || top[0]
  const photos = await photoUrls(top.map(({ entry }) => entry.profile), admin._id)
  return {
    jobs: jobs.map((item) => jobRow(item, companies)),
    job: jobRow(job, companies),
    candidates: top.map(({ entry, result }) => ({
      id: String(entry.user._id),
      fullName: entry.user.fullName,
      photoUrl: photos.get(String(entry.user._id)) ?? null,
      headline: entry.profile.headline ?? '',
      score: result.score,
      label: result.label ?? null,
    })),
    selected: chosen ? { candidateId: String(chosen.entry.user._id), evidence: matchEvidence(chosen.entry.profile, job) } : null,
  }
}

/* ---------- explanation feedback (M-067) ---------- */

/** "Helpful" and "Needs review" in total and per job, the most rated jobs first. */
export async function feedbackSummary() {
  const rows = await ExplanationFeedback.aggregate([{ $group: { _id: { jobId: '$jobId', value: '$value' }, count: { $sum: 1 } } }])
  const byJob = new Map()
  for (const { _id, count } of rows) {
    const entry = byJob.get(String(_id.jobId)) ?? { helpful: 0, needsReview: 0 }
    entry[_id.value === 'helpful' ? 'helpful' : 'needsReview'] += count
    byJob.set(String(_id.jobId), entry)
  }
  const titles = new Map((await Job.find({ _id: { $in: [...byJob.keys()] } }, 'title')).map((job) => [String(job._id), job.title]))
  const jobs = [...byJob.entries()]
    .map(([id, counts]) => ({ id, title: titles.get(id) ?? null, ...counts }))
    .sort((a, b) => b.helpful + b.needsReview - (a.helpful + a.needsReview))
  return { helpful: jobs.reduce((sum, job) => sum + job.helpful, 0), needsReview: jobs.reduce((sum, job) => sum + job.needsReview, 0), jobs }
}
