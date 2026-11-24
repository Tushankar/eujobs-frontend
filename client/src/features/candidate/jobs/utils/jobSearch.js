/* Find jobs filters as state and as GET /jobs parameters (OD2, U25, P4-Q4, OQ-6i). */
export const EMPTY_FILTERS = { sector: [], workPreference: [], employmentType: [], level: [], place: null, salaryMin: '', eligible: '', visaSponsorship: false }

export function countActiveFilters(filters) {
  return filters.sector.length + filters.workPreference.length + filters.employmentType.length + filters.level.length + [filters.place, filters.salaryMin, filters.eligible, filters.visaSponsorship].filter(Boolean).length
}

/** The filters kept in the Find jobs URL (perf 2026-11-24); `?employmentType=agency` links from Agencies use it too. */
export function filtersFromUrl(params) {
  const list = (name) => params.get(name)?.split(',').filter(Boolean) ?? []
  let place = null
  try {
    place = JSON.parse(params.get('place'))
  } catch {
    // A hand-edited place is ignored.
  }
  return {
    // 2026-11-24: sector keys (landing "Browse by sector", job alert digests).
    sector: list('sector'),
    workPreference: list('workPreference'),
    employmentType: list('employmentType'),
    level: list('level'),
    place: typeof place?.placeId === 'string' ? place : null,
    salaryMin: params.get('salaryMin') ?? '',
    eligible: params.get('eligible') ?? '',
    visaSponsorship: params.get('visaSponsorship') === '1',
  }
}

/** The URL form of the Find jobs state: the GET /jobs parameters, the picked place itself and how many are shown. */
export function urlState({ query, filters, sort, shown }) {
  const { placeId, ...params } = searchParams({ query, filters, sort })
  const empty = { q: '', sector: '', workPreference: '', employmentType: '', level: '', salaryMin: '', eligible: '', visaSponsorship: '' }
  return { ...empty, ...params, sort: sort === 'recommended' ? '' : sort, place: placeId ? JSON.stringify(filters.place) : '', shown }
}

/** Empty values are left out; lists are comma-separated. */
export function searchParams({ query, filters, sort }) {
  const params = {
    q: query.trim(),
    sort,
    sector: filters.sector.join(','),
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
