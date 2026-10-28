import { getMatchEvidence } from './matchEvidence.js'

export const SORT_OPTIONS = [
  { value: 'recommended', label: 'Recommended' },
  { value: 'experience', label: 'Most experience' },
  { value: 'name', label: 'Name (A–Z)' },
]

export const EMPTY_FILTERS = { workMode: '', availability: '', minYears: '', skill: '' }

export function countActiveFilters(filters) {
  return Object.values(filters).filter(Boolean).length
}

/** Every word typed must appear somewhere in the candidate's name, role, company, place, work mode or skills. */
function matchesQuery(candidate, query) {
  const words = query.toLowerCase().split(/[^a-z0-9+#.]+/).filter(Boolean)
  if (words.length === 0) return true
  const haystack = [
    candidate.name,
    candidate.title,
    candidate.company,
    candidate.location,
    candidate.workMode,
    candidate.availability,
    ...candidate.skills,
  ]
    .join(' ')
    .toLowerCase()
  return words.every((word) => haystack.includes(word))
}

function matchesFilters(candidate, { workMode, availability, minYears, skill }) {
  return (
    (!workMode || candidate.workMode === workMode) &&
    (!availability || candidate.availability === availability) &&
    (!minYears || candidate.experienceYears >= Number(minYears)) &&
    (!skill || candidate.skills.includes(skill))
  )
}

/** Search + filters, then sort. "Recommended" puts the most relevant skills for `job` first (stable otherwise). */
export function findCandidates(candidates, { query, filters, sort, job }) {
  const results = candidates.filter((candidate) => matchesQuery(candidate, query) && matchesFilters(candidate, filters))
  if (sort === 'experience') return results.sort((a, b) => b.experienceYears - a.experienceYears)
  if (sort === 'name') return results.sort((a, b) => a.name.localeCompare(b.name))
  const relevance = (candidate) => getMatchEvidence(candidate, job).relevantSkills.length
  return results.sort((a, b) => relevance(b) - relevance(a))
}
