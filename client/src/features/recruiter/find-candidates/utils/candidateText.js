import { useTranslation } from 'react-i18next'
import { useFormat } from '@/lib/preferences.js'

/* How candidate facts read on cards, the compare table and the profile (A: recruiter B2). */

// Right to work is per region (M-021): GB is the UK, every other country is in the EU.
export const regionOf = (countryCode) => (countryCode === 'GB' ? 'uk' : 'eu')

/** The filters of Find candidates and Shortlists as API query parameters (empty values left out). */
export function filterParams({ query, filters, sort, jobId }) {
  const params = {
    q: query.trim(),
    sort,
    jobId,
    workPreference: filters.workPreference,
    availability: filters.availability,
    minYears: filters.minYears,
    skill: filters.skill.trim(),
    language: filters.language,
    languageLevel: filters.language ? filters.languageLevel : '',
    rightToWork: filters.rightToWork ? '1' : '',
    verified: filters.verified ? '1' : '',
    placeId: filters.place?.placeId,
  }
  return Object.fromEntries(Object.entries(params).filter(([, value]) => value))
}

export const EMPTY_FILTERS = { workPreference: '', availability: '', minYears: '', skill: '', language: '', languageLevel: '', rightToWork: false, verified: false, place: null }

export function countActiveFilters(filters) {
  return Object.values(filters).filter(Boolean).length
}

export function useCandidateText() {
  const { t } = useTranslation()
  const format = useFormat()
  const period = (start, end, ongoing) => t('discovery:period', { start: format.month(start), end: ongoing || !end ? t('discovery:present') : format.month(end) })
  return {
    location: (candidate) => (candidate.location ? t('common:city.value', { city: candidate.location.city, country: format.country(candidate.location.countryCode) }) : ''),
    role: (role) => (role ? t('discovery:card.role', { title: role.title, employer: role.employer }) : ''),
    period,
    /** "Right to work: UK · Citizen or settled" for the region of `countryCode`, or null. */
    rightToWork(candidate, countryCode) {
      const entry = candidate.rightToWork.find((item) => item.region === regionOf(countryCode))
      if (!entry) return null
      const status = entry.status === 'visa_permit' && !entry.valid ? t('discovery:card.permitExpired') : t(`enums:rtwStatus.${entry.status}`)
      return t('discovery:card.rightToWork', { region: t(`enums:rtwRegion.${entry.region}`), status })
    },
    languages: (candidate, limit) =>
      candidate.languages
        .slice(0, limit)
        .map((language) => `${format.languageName(language.code)} · ${t(`enums:languageLevel.${language.level}`)}`)
        .join(', '),
    verification: ({ verification }) =>
      verification.verified ? t('discovery:card.verified') : t('discovery:card.partlyVerified', { count: verification.count, total: verification.required }),
  }
}
