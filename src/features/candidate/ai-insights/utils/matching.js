import { PROFILE, ROLES } from '../data/insights.js'

/**
 * Transparent local comparison of the reviewed profile with one role's listed
 * requirements. No scores or percentages: only what is listed and what is not.
 * `skills` is the profile's skill list including skills the candidate has added.
 */
export function compareRole(role, skills = PROFILE.skills) {
  const listed = role.requiredSkills.filter((skill) => skills.includes(skill))
  const missing = role.requiredSkills.filter((skill) => !skills.includes(skill))
  return {
    listed,
    missing,
    allSkillsListed: missing.length === 0,
    yearsMet: PROFILE.yearsReported >= role.minYears,
    workAligned: role.workMode === PROFILE.workPreference,
    locationAligned: role.location === PROFILE.location,
  }
}

/**
 * Profile preview order: roles with at least one listed skill, ordered by listed
 * required skills, then work preference alignment, then whether reported years meet
 * the target. Ties keep their existing order (Array.sort is stable).
 */
export function rankRoles(skills = PROFILE.skills) {
  return ROLES.map((role) => ({ role, match: compareRole(role, skills) }))
    .filter(({ match }) => match.listed.length > 0)
    .sort(
      (a, b) =>
        b.match.listed.length - a.match.listed.length ||
        Number(b.match.workAligned) - Number(a.match.workAligned) ||
        Number(b.match.yearsMet) - Number(a.match.yearsMet),
    )
}

/** Rows of "The evidence, side by side": one per required skill, then experience, work preference and location. */
export function buildEvidenceRows(role, match) {
  const skillRows = role.requiredSkills.map((skill) => {
    const listed = match.listed.includes(skill)
    return {
      label: skill,
      aligned: listed,
      statusLabel: listed ? 'Aligned' : 'Not listed',
      profile: listed ? `Listed as ${skill}` : 'Not listed in your profile',
      requirement: `Required: ${skill}`,
    }
  })
  return [
    ...skillRows,
    {
      label: 'Experience',
      aligned: match.yearsMet,
      statusLabel: match.yearsMet ? 'Aligned' : 'To review',
      profile: `${PROFILE.yearsReported} years reported`,
      requirement: `${role.minYears}+ years relevant experience`,
    },
    {
      label: 'Work preference',
      aligned: match.workAligned,
      statusLabel: match.workAligned ? 'Aligned' : 'To review',
      profile: PROFILE.workPreference,
      requirement: role.workMode,
    },
    {
      label: 'Location',
      aligned: match.locationAligned,
      statusLabel: match.locationAligned ? 'Aligned' : 'To review',
      profile: PROFILE.location,
      requirement: role.location,
    },
  ]
}

/** "Senior UX Designer · Stripe", as shown in the role picker. */
export function roleOptionLabel(role) {
  return `${role.title} · ${role.company}`
}

export function roleMeta(role) {
  return `${role.company} · ${role.workMode} · ${role.salary}`
}
