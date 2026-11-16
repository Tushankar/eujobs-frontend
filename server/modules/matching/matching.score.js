import { LIMITS } from '../../config/limits.js'
import { skillOverlap } from '../../lib/skills.js'
import { hasRightToWorkIn } from '../discovery/discovery.population.js'

/*
 * The match score (M-047, U5, C23, OQ-6g). "experience" switches the embedding similarity, "skills" the share of
 * required skills listed; the weights of the signals that are on are renormalised. "location" caps a mismatch at 49.
 * OpenAI never takes part in the number; it only writes explanations.
 */
const M = LIMITS.matching
const clamp = (value) => Math.min(1, Math.max(0, value))

/**
 * OQ-6g: the candidate cannot take the job from where they are, or the work preference differs. Worldwide since
 * 2026-11-16 (owner): a candidate abroad still fits when they have a valid right to work in the job's country (the EU
 * group covers the 27) or the job offers visa sponsorship; for a remote job with eligible countries, living in one or
 * having the right to work in one counts.
 */
export function locationMismatch(profile, job) {
  const country = profile.location?.countryCode
  const canWorkIn = (code) => country === code || hasRightToWorkIn(profile, code)
  if (job.workPreference === 'remote') {
    if (job.remoteCountries?.length && !job.remoteCountries.some(canWorkIn)) return true
  } else if (!canWorkIn(job.country) && !job.visaSponsorship) return true
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
