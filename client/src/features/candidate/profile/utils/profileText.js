/** Display helpers shared by the profile page and its summary dialog. */

export function experienceLabel(years) {
  return `${years} ${Number(years) === 1 ? 'year' : 'years'} of relevant professional experience`
}

export function salaryLabel(salaryMin) {
  return salaryMin === '' || salaryMin == null ? null : `$${salaryMin}k+ / year`
}

export function initialsOf(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('')
}

/** Plain-text summary composed from the profile fields (no AI service is involved). */
export function buildJobSummary(profile) {
  const salary = salaryLabel(profile.salaryMin)
  const lookingFor = `${profile.workMode.toLowerCase()} roles${salary ? ` at ${salary}` : ''}`
  return [
    `${profile.name} is a ${profile.headline} based in ${profile.location}.`,
    profile.about,
    `${experienceLabel(profile.yearsExperience)}. Key strengths: ${profile.skills.join(', ')}.`,
    `Education: ${profile.degree}, ${profile.institution}.`,
    `${profile.openToOpportunities ? 'Open to opportunities' : 'Not actively looking'}, interested in ${lookingFor}.`,
  ].join('\n\n')
}
