import { LIMITS } from '../../config/limits.js'
import { AppError, fieldError } from '../../lib/errors.js'
import { skillKey, skillOverlap } from '../../lib/skills.js'
import { Application } from '../applications/applications.model.js'
import { candidateSummary, loadProfile, saveProfile } from '../candidates/candidates.service.js'
import { Job, SavedJob } from '../jobs/jobs.model.js'
import { jobCards, jobDetails, recommendedJobs, viewFilter, visibleFilter } from '../jobs/jobs.search.js'
import { matchEvidence } from '../matching/matching.evidence.js'
import { ExplanationFeedback } from './ai.model.js'
import { candidateSubject, jobFacts, write } from './ai.facts.js'
import { PROMPTS } from './ai.prompts.js'

/*
 * AI insights (M-057, M-063 … M-067, §3.18) for Plus candidates. Each page answers its code evidence at once; the
 * narrative is a separate request, so the evidence still shows when OpenAI fails or the daily limit is reached (§2.9).
 */
const ROLE_PICKER = 10
const TOP_MATCHES = 4
const P = LIMITS.profile

/* ---------- jobs ---------- */

/** M-063: the top 10 recommended jobs, then the saved and applied ones; the default is the top-ranked job. */
export async function roles(user) {
  const top = (await recommendedJobs(user)).items.slice(0, ROLE_PICKER)
  const known = new Set(top.map((job) => job.id))
  const ids = [...(await SavedJob.distinct('jobId', { candidateId: user._id })), ...(await Application.distinct('jobId', { candidateId: user._id }))]
  const extra = await Job.find({ _id: { $in: [...new Set(ids.map(String))].filter((id) => !known.has(id)) }, status: { $ne: 'draft' } }).sort({ publishedAt: -1 })
  const items = [...top, ...(await jobCards(user, extra))]
  return { items, total: items.length, page: 1, pageSize: items.length }
}

/** The chosen job (one the candidate may open, M-043), or the top of the role picker. */
async function chosenJob(user, jobId) {
  const id = jobId ?? (await roles(user)).items[0]?.id
  if (!id) return null
  const card = await jobDetails(user, id)
  return { card, job: await Job.findById(id) }
}

/* ---------- pages ---------- */

/** M-066: the denominator is every visible published job of the candidate's picker country. */
export async function overview(user) {
  const profile = await loadProfile(user._id)
  const jobs = await Job.find({ ...(await visibleFilter()), ...viewFilter(user.pickerCountry ?? 'REMOTE') })
  const skillDemand = profile.skills
    .map((skill) => ({ skill: skill.name, jobCount: jobs.filter((job) => [...job.requiredSkills, ...job.preferredSkills].some((item) => item.key === skill.key)).length }))
    .sort((a, b) => b.jobCount - a.jobCount)
  return {
    profile: { fullName: user.fullName, headline: profile.headline ?? '', location: profile.location?.placeId ? { city: profile.location.city, countryCode: profile.location.countryCode } : null },
    stats: {
      skillsCount: profile.skills.length,
      rolesWithAlignedSkills: jobs.filter((job) => skillOverlap(profile.skills, job).requiredMatched > 0).length,
      jobsConsidered: jobs.length,
      yearsExperience: profile.yearsExperience ?? null,
    },
    skillDemand,
    topMatches: (await recommendedJobs(user)).items.slice(0, TOP_MATCHES),
  }
}

export async function skillGap(user, jobId) {
  const chosen = await chosenJob(user, jobId)
  if (!chosen) return { job: null, evidence: null, learningPlan: [] }
  const profile = await loadProfile(user._id)
  return { job: chosen.card, evidence: matchEvidence(profile, chosen.job), learningPlan: profile.learningPlan.map((skill) => skill.name) }
}

/** §3.2: the checklist areas with their state; the AI hint per area is the narrative. */
export async function improveProfile(user) {
  const [{ completeness }, profile] = await Promise.all([candidateSummary(user), loadProfile(user._id)])
  return { completeness, learningPlan: profile.learningPlan.map((skill) => skill.name) }
}

export async function jobMatch(user, jobId) {
  const chosen = await chosenJob(user, jobId)
  if (!chosen) return { job: null, evidence: null }
  return { job: chosen.card, evidence: matchEvidence(await loadProfile(user._id), chosen.job) }
}

export async function whyRecommended(user, jobId) {
  const chosen = await chosenJob(user, jobId)
  if (!chosen) return { job: null, evidence: null, rank: null, feedback: null }
  const ranked = (await recommendedJobs(user)).items.map((job) => job.id)
  const feedback = await ExplanationFeedback.findOne({ candidateId: user._id, jobId: chosen.job._id })
  return {
    job: chosen.card,
    evidence: matchEvidence(await loadProfile(user._id), chosen.job),
    rank: ranked.includes(chosen.card.id) ? ranked.indexOf(chosen.card.id) + 1 : null,
    feedback: feedback?.value ?? null,
  }
}

/* ---------- narratives (OpenAI, cached per facts and language) ---------- */

export async function narrative(user, { section, jobId }) {
  const { profile, facts } = await candidateSubject(user._id)
  if (section === 'overview') {
    const [strength] = (await overview(user)).skillDemand
    if (!strength) return { text: '' }
    return write(PROMPTS.insightsOverview, { user, subjectId: user._id, input: { candidate: facts, strength: strength.skill, rolesListingIt: strength.jobCount } })
  }
  if (section === 'improve') {
    const { completeness } = await candidateSummary(user)
    return write(PROMPTS.improveProfile, { user, subjectId: user._id, input: { candidate: facts, checklist: completeness.items.map(({ key, done }) => ({ area: key, done })) } })
  }
  const chosen = await chosenJob(user, jobId)
  if (!chosen) throw new AppError('NOT_FOUND')
  const evidence = matchEvidence(profile, chosen.job)
  const input = { candidate: facts, job: await jobFacts(chosen.job), evidence }
  if (section === 'skill_gap') {
    if (!evidence.missingSkills.length) return { guidance: [] }
    return write(PROMPTS.skillGap, { user, subjectId: user._id, input: { ...input, missingSkills: evidence.missingSkills } })
  }
  return write(section === 'why' ? PROMPTS.whyRecommended : PROMPTS.candidateMatch, { user, subjectId: user._id, input })
}

/* ---------- actions ---------- */

/** M-067: Helpful or Needs review on one job's explanation; null clears it. */
export async function saveFeedback(user, jobId, value) {
  await jobDetails(user, jobId)
  if (!value) return ExplanationFeedback.deleteOne({ candidateId: user._id, jobId })
  return ExplanationFeedback.updateOne({ candidateId: user._id, jobId }, { value }, { upsert: true })
}

/** A skill name within the profile skill rules (M-064, P9-Q2): at most 30 characters. */
function checkedSkill(name) {
  const skill = name.trim()
  if (!skill) throw fieldError({ skill: 'required' })
  if (skill.length > P.skills.itemMax) throw fieldError({ skill: 'too_long' }, { max: P.skills.itemMax })
  return { name: skill, key: skillKey(skill) }
}

/** M-064 "I have this skill": added to the profile skills; refused at 12. */
export async function addProfileSkill(user, name) {
  const profile = await loadProfile(user._id)
  const skill = checkedSkill(name)
  if (profile.skills.some((item) => item.key === skill.key)) throw fieldError({ skill: 'duplicate' }, { skill: skill.name })
  if (profile.skills.length >= P.skills.max) throw fieldError({ skill: 'too_many' }, { max: P.skills.max })
  profile.skills.push(skill)
  await saveProfile(user, profile)
  return { skills: profile.skills.map((item) => item.name) }
}

/** Undo of "I have this skill". */
export async function removeProfileSkill(user, name) {
  const profile = await loadProfile(user._id)
  profile.skills = profile.skills.filter((item) => item.key !== skillKey(name))
  await saveProfile(user, profile)
  return { skills: profile.skills.map((item) => item.name) }
}

/** P9-Q2: the learning plan, as profile skills: at most 12 of at most 30 characters; adding twice changes nothing. */
export async function addPlanSkill(user, name) {
  const profile = await loadProfile(user._id)
  const skill = checkedSkill(name)
  if (!profile.learningPlan.some((item) => item.key === skill.key)) {
    if (profile.learningPlan.length >= P.skills.max) throw fieldError({ skill: 'too_many' }, { max: P.skills.max })
    profile.learningPlan.push(skill)
    await profile.save()
  }
  return { items: profile.learningPlan.map((item) => item.name) }
}

export async function removePlanSkill(user, name) {
  const profile = await loadProfile(user._id)
  profile.learningPlan = profile.learningPlan.filter((item) => item.key !== skillKey(name))
  await profile.save()
  return { items: profile.learningPlan.map((item) => item.name) }
}
