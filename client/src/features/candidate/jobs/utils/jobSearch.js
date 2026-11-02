/* Find jobs filters as state and as GET /jobs parameters (OD2, U25, P4-Q4, OQ-6i). */
export const EMPTY_FILTERS = { workPreference: [], level: [], place: null, salaryMin: '', eligible: '' }

export function countActiveFilters(filters) {
  return filters.workPreference.length + filters.level.length + [filters.place, filters.salaryMin, filters.eligible].filter(Boolean).length
}

/** Empty values are left out; lists are comma-separated. */
export function searchParams({ query, filters, sort }) {
  const params = {
    q: query.trim(),
    sort,
    workPreference: filters.workPreference.join(','),
    level: filters.level.join(','),
    placeId: filters.place?.placeId,
    salaryMin: filters.salaryMin,
    eligible: filters.eligible,
  }
  return Object.fromEntries(Object.entries(params).filter(([, value]) => value))
}
