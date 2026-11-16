import { countryOfTimeZone } from './timeZoneCountries.js'

/**
 * M-135, worldwide since 2026-11-16: a sign-up's default country. First where the computer's clock is set
 * (Asia/Kolkata → India), then the browser language's region, else Remote; only offered countries count. Nothing is
 * asked and nothing leaves the browser. Kept apart from countries.js so the zone table loads with sign-up only.
 */
export function browserCountry(options) {
  const offered = (code) => Boolean(code) && options.some((option) => option.code === code)
  const byZone = countryOfTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone)
  if (offered(byZone)) return byZone
  const byLanguage = new Intl.Locale(navigator.language).maximize().region
  return offered(byLanguage) ? byLanguage : 'REMOTE'
}
