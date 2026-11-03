import { ENUMS } from '../../config/enums.js'
import { skillOverlap } from '../../lib/skills.js'
import { hasRightToWorkIn } from '../discovery/discovery.population.js'
import { locationMismatch } from './matching.score.js'

/*
 * M-057: the code-computed evidence of a candidate and a job: listed and missing skills, years, work mode, location,
 * languages and right to work. OpenAI only writes the narrative around it; nothing here is invented.
 */
const LEVELS = ENUMS.languageLevel

export function matchEvidence(profile, job) {
  const overlap = skillOverlap(profile.skills, job)
  const years = profile.yearsExperience ?? null
  return {
    matchedSkills: overlap.matched,
    missingSkills: overlap.missing,
    requiredSkills: job.requiredSkills.length,
    years: { candidate: years, required: job.experienceYears ?? null, met: job.experienceYears == null || (years ?? 0) >= job.experienceYears },
    workMode: { candidate: profile.workPreference ?? null, job: job.workPreference ?? null, met: profile.workPreference === job.workPreference },
    location: { countryCode: profile.location?.countryCode ?? null, met: !locationMismatch(profile, job) },
    languages: job.requiredLanguages.map(({ code, minLevel }) => {
      const level = profile.languages.find((language) => language.code === code)?.level ?? null
      return { code, minLevel, level, met: Boolean(level) && LEVELS.indexOf(level) >= LEVELS.indexOf(minLevel) }
    }),
    // OD4: null for a remote job, which has no single country.
    rightToWork: job.country && job.country !== 'REMOTE' ? hasRightToWorkIn(profile, job.country) : null,
  }
}
