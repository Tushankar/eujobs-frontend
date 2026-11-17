import ISO6391 from 'iso-639-1'
import { LIMITS } from '../../config/limits.js'
import { AppError } from '../../lib/errors.js'
import { skillOverlap } from '../../lib/skills.js'
import { Application } from '../applications/applications.model.js'
import { CandidateProfile } from '../candidates/candidates.model.js'
import { Company } from '../companies/companies.model.js'
import { Job } from '../jobs/jobs.model.js'
import { MatchResult } from '../matching/matching.model.js'
import { User } from '../users/users.model.js'
import { jobFacts, write } from './ai.facts.js'
import { PROMPTS } from './ai.prompts.js'

/*
 * Recruiter drafts (owner 2026-11-17, phase 2): the job post writer and the company description writer. Each is one AI
 * use of the recruiter's daily cap (a cached answer is free) and only a draft: the client puts it into the form, the
 * recruiter edits and saves as usual. Answers are cut to the form's own limits, so a draft always saves.
 */
const J = LIMITS.job

const clip = (value, max) => String(value ?? '').trim().slice(0, max).trim()

/** Unique (case-insensitive), non-empty, cut to `itemMax` and at most `max`; `except` drops names already used. */
function names(items, { itemMax, max }, except = []) {
  const seen = new Set(except.map((name) => name.toLowerCase()))
  const out = []
  for (const item of items ?? []) {
    const name = clip(item, itemMax)
    if (!name || seen.has(name.toLowerCase())) continue
    seen.add(name.toLowerCase())
    out.push(name)
  }
  return out.slice(0, max)
}

/** The recruiter's company as the facts a draft may use. */
async function companyFacts(user) {
  const company = await Company.findById(user.companyId, 'displayName industry size location description')
  return company && { name: company.displayName, industry: company.industry ?? null, size: company.size ?? null, city: company.location?.city ?? null, about: company.description?.slice(0, 600) || null }
}

/** POST /recruiter/ai/job-draft: brief, responsibilities, skills, level, years and languages for a title. */
export async function jobDraft(user, { title, employmentType, notes }) {
  const input = { title, employmentType, notes: notes || null, company: await companyFacts(user) }
  const draft = await write(PROMPTS.jobDraft, { user, input })
  const requiredSkills = names(draft.requiredSkills, J.requiredSkills)
  const codes = new Set()
  return {
    brief: clip(draft.brief, J.brief.max),
    responsibilities: names(draft.responsibilities, J.responsibilities),
    requiredSkills,
    preferredSkills: names(draft.preferredSkills, J.preferredSkills, requiredSkills),
    level: draft.level,
    experienceYears: Math.min(J.experienceYears.max, Math.max(J.experienceYears.min, Math.round(draft.experienceYears))),
    requiredLanguages: draft.languages
      .map(({ code, minLevel }) => ({ code: code.trim().toLowerCase(), minLevel }))
      .filter(({ code }) => ISO6391.validate(code) && !codes.has(code) && codes.add(code))
      .slice(0, J.languages.max),
  }
}

/** POST /recruiter/ai/company-description: the "About the company" text from the details in the form. */
export async function companyDescription(user, { name, industry, size, city, notes }) {
  const input = { company: { name, industry: industry || null, size: size || null, city: city || null }, notes: notes || null }
  const { description } = await write(PROMPTS.companyDescription, { user, input })
  return { description: clip(description, LIMITS.company.description.max) }
}

const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * A cover note with the candidate's own name parts (as signed, "Ada", "Lovelace") taken out, so names never reach
 * OpenAI. Letter-aware boundaries, so accented names ("José") are matched too.
 */
function withoutName(note, fullName) {
  const parts = (fullName ?? '').split(/\s+/).filter((part) => part.length >= 2)
  return parts.reduce((text, part) => text.replace(new RegExp(`(?<![\\p{L}\\p{N}])${escape(part)}(?![\\p{L}\\p{N}])`, 'giu'), 'the candidate'), note)
}

/**
 * POST /recruiter/ai/jobs/:id/shortlist: the job's newest unreviewed applicants (status applied) ranked for a first
 * read, at most LIMITS.ai.shortlist.size with a one-line reason each. The AI sees only evidence under the application
 * id (skills against the job, years, headline, location, the match score, the cover note), never a name or photo. The
 * answer is cached by that evidence, so asking again without new applicants costs nothing.
 */
export async function applicantShortlist(user, id) {
  const job = await Job.findOne({ _id: id, companyId: user.companyId })
  if (!job) throw new AppError('NOT_FOUND')
  const S = LIMITS.ai.shortlist
  const applications = await Application.find({ jobId: job._id, status: 'applied' }, 'candidateId coverNote appliedAt').sort({ appliedAt: -1 }).limit(S.candidates)
  if (!applications.length) return { items: [], considered: 0 }
  const candidateIds = applications.map((application) => application.candidateId)
  const [profiles, users, results] = await Promise.all([
    CandidateProfile.find({ userId: { $in: candidateIds } }),
    User.find({ _id: { $in: candidateIds } }, 'fullName photoFileId'),
    MatchResult.find({ jobId: job._id, candidateId: { $in: candidateIds } }, 'candidateId score'),
  ])
  const profileOf = new Map(profiles.map((profile) => [String(profile.userId), profile]))
  const scoreOf = new Map(results.map((result) => [String(result.candidateId), result.score]))
  const nameOf = new Map(users.map((candidate) => [String(candidate._id), candidate.fullName ?? '']))
  const applicants = applications.map((application) => {
    const profile = profileOf.get(String(application.candidateId))
    const overlap = profile ? skillOverlap(profile.skills, job) : { matched: [], missing: job.requiredSkills.map((skill) => skill.name) }
    return {
      applicationId: String(application._id),
      headline: profile?.headline ?? '',
      yearsExperience: profile?.yearsExperience ?? null,
      matchedSkills: overlap.matched,
      missingRequiredSkills: overlap.missing,
      country: profile?.location?.countryCode ?? null,
      workPreference: profile?.workPreference ?? null,
      matchScore: scoreOf.get(String(application.candidateId)) ?? null,
      coverNote: withoutName(application.coverNote ?? '', nameOf.get(String(application.candidateId))).slice(0, 400),
    }
  })
  const facts = await jobFacts(job)
  const input = {
    job: { title: facts.title, level: facts.level, experienceYears: facts.experienceYears, requiredSkills: facts.requiredSkills, preferredSkills: facts.preferredSkills, workPreference: facts.workPreference, country: facts.country, city: facts.city },
    applicants,
  }
  const { items } = await write(PROMPTS.applicantShortlist, { user, input })
  const byApplication = new Map(applications.map((application) => [String(application._id), application]))
  const userOf = new Map(users.map((candidate) => [String(candidate._id), candidate]))
  const seen = new Set()
  return {
    considered: applications.length,
    items: items
      .filter(({ applicationId }) => byApplication.has(applicationId) && !seen.has(applicationId) && seen.add(applicationId))
      .slice(0, S.size)
      .map(({ applicationId, reason }) => {
        const candidateId = String(byApplication.get(applicationId).candidateId)
        const profile = profileOf.get(candidateId)
        return { applicationId, reason: reason.trim(), candidate: { id: candidateId, fullName: userOf.get(candidateId)?.fullName ?? null, headline: profile?.headline ?? '' } }
      }),
  }
}
