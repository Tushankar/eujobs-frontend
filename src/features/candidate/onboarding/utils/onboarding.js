import { MAX_LOCATION_LENGTH, MAX_SALARY_K } from '../data/onboarding.js'

/** "84 KB", "2.4 MB" */
export function formatFileSize(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** Field errors for the preferences step ({} when valid). `salaryMin` is the raw text typed by the user. */
export function validatePreferences({ location, salaryMin }) {
  const errors = {}

  const place = location.trim()
  if (!place) errors.location = 'Enter your preferred location.'
  else if (place.length > MAX_LOCATION_LENGTH) errors.location = `Keep your location to ${MAX_LOCATION_LENGTH} characters or fewer.`

  const salary = salaryMin.trim()
  if (!salary) errors.salaryMin = 'Enter your minimum annual salary in thousands, for example 120.'
  else if (!/^\d+$/.test(salary) || Number(salary) < 1) errors.salaryMin = 'Enter a whole number above 0, in thousands (120 means $120k).'
  else if (Number(salary) > MAX_SALARY_K) errors.salaryMin = `Enter ${MAX_SALARY_K} or less. The amount is in thousands (${MAX_SALARY_K} means $1M).`

  return errors
}
