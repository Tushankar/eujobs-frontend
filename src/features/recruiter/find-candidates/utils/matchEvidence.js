const sameSkill = (a, b) => a.toLowerCase() === b.toLowerCase()

/**
 * Evidence for how a candidate's listed skills line up with a job (never a score or a percentage).
 * `relevantSkills` are the job's skills the candidate lists, in the job's order; `missingSkills` are required
 * skills the profile does not list (unknown, not a lack of ability). `job` may be null.
 */
export function getMatchEvidence(candidate, job) {
  const required = job?.requiredSkills ?? []
  const wanted = [...required, ...(job?.preferredSkills ?? [])]
  const listed = (skill) => candidate.skills.some((candidateSkill) => sameSkill(candidateSkill, skill))
  return {
    relevantSkills: wanted.filter(listed),
    missingSkills: required.filter((skill) => !listed(skill)),
  }
}

/** "3 relevant skills · 6 years of experience · Remote" (the skills part is left out when there is no job). */
export function summarizeMatch(candidate, evidence, hasJob) {
  const count = evidence.relevantSkills.length
  return [
    hasJob && `${count} relevant ${count === 1 ? 'skill' : 'skills'}`,
    `${candidate.experienceYears} years of experience`,
    candidate.workMode,
  ]
    .filter(Boolean)
    .join(' · ')
}
