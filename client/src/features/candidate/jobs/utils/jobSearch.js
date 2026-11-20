/* Find jobs filters as state and as GET /jobs parameters (OD2, U25, P4-Q4, OQ-6i). */
export const EMPTY_FILTERS = { workPreference: [], employmentType: [], level: [], place: null, salaryMin: '', eligible: '', visaSponsorship: false }

export function countActiveFilters(filters) {
  return filters.workPreference.length + filters.employmentType.length + filters.level.length + [filters.place, filters.salaryMin, filters.eligible, filters.visaSponsorship].filter(Boolean).length
}

/** Empty values are left out; lists are comma-separated. */
export function searchParams({ query, filters, sort }) {
  const params = {
    q: query.trim(),
    sort,
    workPreference: filters.workPreference.join(','),
    // 2026-11-20: job types, "agency" included.
    employmentType: filters.employmentType.join(','),
    level: filters.level.join(','),
    placeId: filters.place?.placeId,
    salaryMin: filters.salaryMin,
    eligible: filters.eligible,
    // Only jobs that sponsor a work visa (2026-11-16).
    visaSponsorship: filters.visaSponsorship ? '1' : '',
  }
  return Object.fromEntries(Object.entries(params).filter(([, value]) => value))
}
