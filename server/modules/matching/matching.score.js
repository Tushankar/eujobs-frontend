import { LIMITS } from '../../config/limits.js'
import { skillOverlap } from '../../lib/skills.js'

/*
 * The match score (M-047, U5, C23, OQ-6g). "experience" switches the embedding similarity, "skills" the share of
 * required skills listed; the weights of the signals that are on are renormalised. "location" caps a mismatch at 49.
 * OpenAI never takes part in the number; it only writes explanations.
 */
const M = LIMITS.matching
const clamp = (value) => Math.min(1, Math.max(0, value))

/** OQ-6g: the profile country is outside the job's country or remote eligibility, or the work preference differs. */
export function locationMismatch(profile, job) {
  const country = profile.location?.countryCode
  if (job.workPreference === 'remote') {
    if (job.remoteCountries?.length && !job.remoteCountries.includes(country)) return true
  } else if (country !== job.country) return true
  return profile.workPreference !== job.workPreference
}

export function labelFor(score, thresholds) {
  if (score >= thresholds.strong) return 'strong'
  if (score >= thresholds.good) return 'good'
  return null
}

/** `cos` is the cosine of the candidate and job vectors; `policy` holds signals, weights and thresholds. */
export function scoreMatch({ cos, profile, job, policy }) {
  const { signals, weights, thresholds } = policy
  const sim = clamp((cos - M.cosFloor) / (M.cosCeiling - M.cosFloor))
  const overlap = skillOverlap(profile.skills, job)
  const skillShare = job.requiredSkills.length ? overlap.requiredMatched / job.requiredSkills.length : 0
  const parts = [signals.experience && [weights.sim, sim], signals.skills && [weights.skill, skillShare]].filter(Boolean)
  const weight = parts.reduce((sum, [part]) => sum + part, 0)
  let score = Math.round((100 * parts.reduce((sum, [part, value]) => sum + part * value, 0)) / weight)
  const locationCapped = Boolean(signals.location && locationMismatch(profile, job) && score > M.locationCap)
  if (locationCapped) score = M.locationCap
  return { score, label: labelFor(score, thresholds), sim, skillShare, locationCapped, matchedSkills: overlap.matched, missingSkills: overlap.missing }
}
