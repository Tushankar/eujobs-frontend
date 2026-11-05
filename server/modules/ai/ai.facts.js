import { generate } from '../../lib/ai.js'
import { CandidateProfile } from '../candidates/candidates.model.js'
import { Company } from '../companies/companies.model.js'
import { CvVersion } from '../cv/cv.model.js'

/*
 * The facts an AI text is written from. They are also the cache key (M-058, M-057: entity version + language +
 * profile hash): any change to a fact makes a new entry, so nothing needs invalidating by hand. Photos and anything
 * protected are never facts (M-013, M-021).
 */
const CV_CHARS = 6000

export function candidateFacts(profile, cvText) {
  return {
    headline: profile.headline ?? '',
    about: profile.about ?? '',
    yearsExperience: profile.yearsExperience ?? null,
    skills: profile.skills.map((skill) => skill.name),
    workPreference: profile.workPreference ?? null,
    country: profile.location?.countryCode ?? null,
    workHistory: profile.workHistory.map(({ title, employer, start, end, current, description }) => ({ title, employer, start, end: current ? 'present' : (end ?? null), description: description ?? '' })),
    education: profile.education.map(({ degree, institution }) => ({ degree, institution })),
    languages: profile.languages.map(({ code, level }) => ({ code, level })),
    cvText: (cvText ?? '').slice(0, CV_CHARS),
  }
}

/** The candidate's profile and the facts from it with the live CV text. */
export async function candidateSubject(userId) {
  const profile = await CandidateProfile.findOne({ userId })
  const cv = profile?.liveCvVersionId ? await CvVersion.findById(profile.liveCvVersionId, 'extractedText') : null
  return { profile, facts: profile ? candidateFacts(profile, cv?.extractedText) : null }
}

export async function jobFacts(job) {
  const company = await Company.findById(job.companyId, 'displayName industry size')
  return {
    title: job.title,
    company: company?.displayName ?? null,
    industry: company?.industry ?? null,
    brief: job.brief ?? '',
    responsibilities: job.responsibilities,
    requiredSkills: job.requiredSkills.map((skill) => skill.name),
    preferredSkills: job.preferredSkills.map((skill) => skill.name),
    level: job.level ?? null,
    experienceYears: job.experienceYears ?? null,
    employmentType: job.employmentType ?? null,
    workPreference: job.workPreference ?? null,
    country: job.country ?? null,
    city: job.location?.city ?? null,
    remoteCountries: job.remoteCountries,
    salary: job.salary?.min != null || job.salary?.max != null ? { min: job.salary.min ?? null, max: job.salary.max ?? null, currency: job.salary.currency, period: job.salary.period } : null,
    requiredLanguages: job.requiredLanguages.map(({ code, minLevel }) => ({ code, minLevel })),
  }
}

/** One AI text from a prompt of ai.prompts.js, cached by its facts and the reader's language. */
export function write(prompt, { user, input, subjectId = null, model = 'fast', regenerate = false, cache = true }) {
  return generate({
    kind: prompt.kind,
    user,
    language: user.language,
    cacheKey: cache ? { prompt: prompt.instructions, input } : null,
    subjectId,
    model,
    instructions: prompt.instructions,
    input,
    schema: prompt.schema,
    regenerate,
  })
}
