import { LIMITS } from '../../config/limits.js'
import { AppError } from '../../lib/errors.js'
import { skillOverlap } from '../../lib/skills.js'
import { jobFacts, write } from '../ai/ai.facts.js'
import { PROMPTS } from '../ai/ai.prompts.js'
import { CandidateProfile } from '../candidates/candidates.model.js'
import { Job } from '../jobs/jobs.model.js'
import { MatchResult } from '../matching/matching.model.js'
import { User } from '../users/users.model.js'
import { AgencyClient, AgencyMembership, AgencyPlacement } from './agencies.model.js'
import { currentAgreement } from './agreements.service.js'
import { checkWith, targetOf } from './lock.js'

/*
 * Phase 6 (owner 2026-11-23): the agency's on-books talent ranked for one of its agency jobs, on every plan. The order
 * is the stored match score (else required-skill overlap); OpenAI never sets it. People whose placements block the
 * job's dates (the rule check) are left out and only counted. Someone already offered or placed on this job stays
 * listed with that state. "AI reasons" (Agency Plus, 1 credit, cached) adds one line per person from evidence without
 * names.
 */
const R = LIMITS.ai.shortlist

async function ownAgencyJob(company, jobId) {
  const job = await Job.findOne({ _id: jobId, companyId: company._id, agency: { $ne: null } })
  if (!job) throw new AppError('NOT_FOUND')
  return job
}

/** The ranked people with what the reasons need (profile, overlap, score). */
async function ranked(company, job) {
  const memberships = await AgencyMembership.find({ companyId: company._id, status: 'active' }, 'candidateId acceptances')
  const ids = memberships.map((membership) => membership.candidateId)
  const [users, profiles, results, placements, current, client] = await Promise.all([
    User.find({ _id: { $in: ids }, status: 'active' }, 'fullName'),
    CandidateProfile.find({ userId: { $in: ids } }, 'userId headline location skills yearsExperience workPreference'),
    MatchResult.find({ jobId: job._id, candidateId: { $in: ids } }, 'candidateId score label'),
    AgencyPlacement.find({ candidateId: { $in: ids }, status: { $in: ['offered', 'confirmed'] } }),
    currentAgreement(company._id),
    job.agency.clientId && AgencyClient.findById(job.agency.clientId, 'nameKey linkedCompanyId'),
  ])
  const userOf = new Map(users.map((user) => [String(user._id), user]))
  const profileOf = new Map(profiles.map((profile) => [String(profile.userId), profile]))
  const resultOf = new Map(results.map((result) => [String(result.candidateId), result]))
  const target = targetOf(job, client)
  let hidden = 0
  const people = []
  for (const membership of memberships) {
    const id = String(membership.candidateId)
    const user = userOf.get(id)
    if (!user) continue
    const own = placements.filter((placement) => String(placement.candidateId) === id)
    const onThisJob = own.find((placement) => String(placement.jobId) === String(job._id))
    const confirmed = own.filter((placement) => placement.status === 'confirmed' && placement !== onThisJob)
    if (!onThisJob && !checkWith(confirmed, target).allowed) {
      hidden += 1
      continue
    }
    const profile = profileOf.get(id)
    people.push({
      membership,
      user,
      profile,
      result: resultOf.get(id) ?? null,
      overlap: skillOverlap(profile?.skills ?? [], job),
      state: onThisJob ? (onThisJob.status === 'offered' ? 'offered' : 'placed') : 'free',
      needsAgreement: !current || membership.acceptances.at(-1)?.version !== current.version,
    })
  }
  people.sort(
    (a, b) =>
      (b.result?.score ?? -1) - (a.result?.score ?? -1) ||
      b.overlap.requiredMatched - a.overlap.requiredMatched ||
      b.overlap.matched.length - a.overlap.matched.length ||
      (a.user.fullName ?? '').localeCompare(b.user.fullName ?? ''),
  )
  return { people, hidden }
}

/** GET /agency/talent/ranking?jobId=: the on-books talent for the job, best first, and how many a placement hides. */
export async function rankTalent(company, jobId) {
  const job = await ownAgencyJob(company, jobId)
  const { people, hidden } = await ranked(company, job)
  return {
    job: { id: String(job._id), title: job.title, status: job.status, startDate: job.agency.startDate ?? null, endDate: job.agency.endDate ?? null },
    hidden,
    items: people.map(({ membership, user, profile, result, overlap, state, needsAgreement }) => ({
      membershipId: String(membership._id),
      candidate: {
        id: String(user._id),
        name: user.fullName ?? null,
        headline: profile?.headline ?? null,
        location: profile?.location?.placeId ? { countryCode: profile.location.countryCode, city: profile.location.city } : null,
      },
      match: result ? { score: result.score, label: result.label ?? null } : null,
      overlap: { matched: overlap.matched, count: overlap.matched.length, total: overlap.total },
      state,
      needsAgreement,
    })),
  }
}

/**
 * POST /agency/talent/ranking/reasons { jobId }: one line per person for the first LIMITS.ai.shortlist.size people
 * who are free for the job. Evidence goes under the membership id, never a name; the answer is cached by it.
 */
export async function rankingReasons(user, company, jobId) {
  const job = await ownAgencyJob(company, jobId)
  const people = (await ranked(company, job)).people.filter((person) => person.state === 'free').slice(0, R.size)
  if (!people.length) return { items: [] }
  const facts = await jobFacts(job)
  const input = {
    job: { title: facts.title, level: facts.level, experienceYears: facts.experienceYears, requiredSkills: facts.requiredSkills, preferredSkills: facts.preferredSkills, workPreference: facts.workPreference, country: facts.country, city: facts.city },
    people: people.map(({ membership, profile, result, overlap }) => ({
      membershipId: String(membership._id),
      headline: profile?.headline ?? '',
      yearsExperience: profile?.yearsExperience ?? null,
      matchedSkills: overlap.matched,
      missingRequiredSkills: overlap.missing,
      country: profile?.location?.countryCode ?? null,
      workPreference: profile?.workPreference ?? null,
      matchScore: result?.score ?? null,
    })),
  }
  const { items } = await write(PROMPTS.talentRanking, { user, input })
  const valid = new Set(input.people.map((person) => person.membershipId))
  const seen = new Set()
  return {
    items: items
      .filter(({ membershipId }) => valid.has(membershipId) && !seen.has(membershipId) && seen.add(membershipId))
      .map(({ membershipId, reason }) => ({ membershipId, reason: reason.trim() })),
  }
}
