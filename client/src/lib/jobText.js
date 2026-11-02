import { useTranslation } from 'react-i18next'
import { useFormat } from './preferences.js'

/**
 * How a job's place and salary read on cards, tables and details (M-131, OD2, OQ-6i), for candidates and recruiters.
 * The salary is shown in the job's own currency with its period; remote jobs read "Remote".
 */
export function useJobText() {
  const { t } = useTranslation()
  const format = useFormat()
  return {
    place(job) {
      if (job.country === 'REMOTE') return t('common:remote')
      return job.location ? t('common:city.value', { city: job.location.city, country: format.country(job.location.countryCode) }) : ''
    },
    salary(job) {
      const { salary } = job
      if (!salary?.currency) return ''
      const range = salary.min == null ? { min: salary.max, max: null } : salary
      return `${format.salary({ ...range, currency: salary.currency })} ${t(`enums:salaryPeriod.${salary.period}`)}`
    },
    /** OQ-6i: the eligible countries of a remote job, or null when it is open to all EU 27 + UK. */
    eligible(job) {
      return job.country === 'REMOTE' && job.remoteCountries.length ? format.list(job.remoteCountries.map((code) => format.country(code))) : null
    },
  }
}
