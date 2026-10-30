/** Display helpers of the device-only profile, still used by Data & account and the recruiter applicant view (P3-D10). */

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
