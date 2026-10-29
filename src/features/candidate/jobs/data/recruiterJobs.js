import { ROLE_DETAILS } from './jobs.js'

/*
 * Recruiter postings shown to candidates. A recruiter job `x` is the candidate job `acme-x`: the three
 * Acme Studio listings in JOBS already follow this rule, so postings created in the recruiter workspace
 * join them under the same ids (and applications can be traced back to the recruiter's job).
 */
const ID_PREFIX = 'acme-'
const LOGO_COLOURS = { bg: '#ece8f8', color: '#6652a8' }
const HOUR_MS = 3_600_000

export const candidateJobId = (recruiterJobId) => `${ID_PREFIX}${recruiterJobId}`

/** The recruiter job id behind a candidate job id, or null for jobs from other companies. */
export const recruiterJobIdOf = (jobId) => (jobId.startsWith(ID_PREFIX) ? jobId.slice(ID_PREFIX.length) : null)

function firstSentence(text) {
  const sentence = text.split(/(?<=[.!?])\s/)[0]
  return sentence.length > 120 ? `${sentence.slice(0, 117).trimEnd()}…` : sentence
}

/** A recruiter job as a candidate-facing job; skill matching is read from the candidate's own profile. */
export function toCandidateJob(job, company, profile) {
  const requiredSkills = job.requiredSkills ?? []
  const preferredSkills = job.preferredSkills ?? []
  const owned = new Set((profile?.skills ?? []).map((skill) => skill.toLowerCase()))
  const matchingSkills = requiredSkills.filter((skill) => owned.has(skill.toLowerCase())).length
  const share = requiredSkills.length ? matchingSkills / requiredSkills.length : 0
  const experience = `${job.experienceYears ?? 0}+ years`
  const description = job.description ?? ''
  // Salaries are annual and optional: a missing bound falls back to the other, none at all stays null (sorted last).
  const low = job.salaryMin ?? job.salaryMax
  const high = job.salaryMax ?? job.salaryMin

  return {
    id: candidateJobId(job.id),
    company: job.company || company.name,
    logo: { glyph: (job.company || company.name).trim().charAt(0).toUpperCase(), ...LOGO_COLOURS },
    title: job.title,
    tagline: firstSentence(description),
    matchLabel: share >= 2 / 3 ? 'Strong match' : 'Good match',
    aiMatch: Math.round(share * 100),
    location: job.location,
    workMode: job.workPreference,
    type: job.employmentType,
    salaryMin: low == null ? null : Math.round(low / 1000),
    salaryMax: high == null ? 0 : Math.round(high / 1000),
    level: job.level,
    experience,
    skills: requiredSkills,
    matchingSkills,
    alignment: profile?.workMode === job.workPreference ? 'Work preference aligned' : 'Relevant experience',
    postedHoursAgo: Math.max(1, Math.floor((Date.now() - new Date(job.createdAt).getTime()) / HOUR_MS)),
    industry: company.industry,
    companySize: company.size,
    companyAbout: company.description,
    details: {
      about: description,
      impact: job.responsibilities?.length ? job.responsibilities : ROLE_DETAILS.impact,
      bring: [`${experience} of relevant experience.`, `Skills in ${requiredSkills.join(', ')}.`],
      niceToHave: preferredSkills.length ? [`Experience with ${preferredSkills.join(', ')}.`] : ROLE_DETAILS.niceToHave,
      perks: ROLE_DETAILS.perks,
    },
  }
}
