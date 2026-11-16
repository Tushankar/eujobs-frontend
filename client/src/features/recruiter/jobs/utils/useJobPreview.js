import { useGetCountriesQuery } from '@/app/api.js'
import { valuesToBody } from './jobForm.js'

/**
 * What candidates will see: the API shape of the job, with the city and the currency it will get.
 * M-131: the salary currency follows the job country; a remote job pays in the currency the recruiter picks (2026-11-16).
 */
export function useJobPreview(values) {
  const { data: countries = [] } = useGetCountriesQuery()
  const remote = values.workPreference === 'remote'
  const countryCode = remote ? 'REMOTE' : values.place?.countryCode
  const currency = remote ? values.salaryCurrency : countries.find((country) => country.code === countryCode)?.currency
  const body = valuesToBody(values)
  const preview = { ...body, location: remote ? null : values.place, country: countryCode, salary: currency && body.salary ? { ...body.salary, currency } : null }
  return { preview, currency, remote }
}
