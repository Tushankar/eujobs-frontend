/*
 * Formatting rules (§2.15, §3.11): every number, amount and date goes through Intl with the
 * user's format locale. Pure functions; components use the bound versions from useFormat().
 */
const DEFAULT_REGION = { en: 'IE', es: 'ES', fr: 'FR' }

/** M-133, M-132, OQ-6b: `<language>-<country>`; Remote and admins (no country) use the language's default region. */
export function formatLocale(language, country) {
  const region = country && country !== 'REMOTE' ? country : DEFAULT_REGION[language] ?? DEFAULT_REGION.en
  return `${language}-${region}`
}

export function formatNumber(value, locale, options) {
  return new Intl.NumberFormat(locale, options).format(value)
}

/** U24: integer minor units (two decimals in all eight currencies, D2); whole amounts show no decimals. */
export function formatMoney(amountMinor, currency, locale) {
  const amount = amountMinor / 100
  const digits = Number.isInteger(amount) ? 0 : 2
  return new Intl.NumberFormat(locale, { style: 'currency', currency, minimumFractionDigits: digits, maximumFractionDigits: digits }).format(amount)
}

/** A salary in major units (M-131); the caller adds the translated period. */
export function formatSalary({ min, max, currency }, locale) {
  const format = new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 0 })
  return max == null || min === max ? format.format(min) : format.formatRange(min, max)
}

/** A date-only value ("YYYY-MM-DD") or an instant. Date-only values never move with the time zone (M-133). */
export function formatDate(value, locale, options = { dateStyle: 'medium' }) {
  const dateOnly = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  return new Intl.DateTimeFormat(locale, { ...options, ...(dateOnly && { timeZone: 'UTC' }) }).format(new Date(value))
}

export function formatDateTime(value, locale) {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

/** "YYYY-MM" (work history, education) as month and year. */
export function formatMonth(value, locale) {
  return new Intl.DateTimeFormat(locale, { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}-01T00:00:00Z`))
}

const UNITS = [
  ['year', 365 * 86400],
  ['month', 30 * 86400],
  ['week', 7 * 86400],
  ['day', 86400],
  ['hour', 3600],
  ['minute', 60],
  ['second', 1],
]

/** "3 days ago", "in 2 hours", "yesterday". */
export function formatRelative(value, locale, now = Date.now()) {
  const seconds = Math.round((new Date(value).getTime() - now) / 1000)
  const [unit, size] = UNITS.find(([, length]) => Math.abs(seconds) >= length) ?? UNITS.at(-1)
  return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(Math.round(seconds / size), unit)
}

/** Short weekday names, Monday first. */
export function weekdayLabels(locale) {
  const format = new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' })
  // 1 January 2024 was a Monday.
  return Array.from({ length: 7 }, (_, index) => format.format(new Date(Date.UTC(2024, 0, 1 + index))))
}

/** "84 kB", "2.4 MB" in the user's locale. */
export function formatFileSize(bytes, locale) {
  const megabytes = bytes / (1024 * 1024)
  if (megabytes >= 1) return new Intl.NumberFormat(locale, { style: 'unit', unit: 'megabyte', maximumFractionDigits: 1 }).format(megabytes)
  return new Intl.NumberFormat(locale, { style: 'unit', unit: 'kilobyte', maximumFractionDigits: 0 }).format(Math.max(1, bytes / 1024))
}

/** "PDF or DOCX" (`disjunction`) or "A, B and C" (`conjunction`). */
export function formatList(items, locale, type = 'conjunction') {
  return new Intl.ListFormat(locale, { type }).format(items)
}

/** An ISO 639-1 language's name in the UI language (M-020). */
export function languageNameIn(code, language) {
  return new Intl.DisplayNames([language], { type: 'language' }).of(code)
}

/** A country's name in the UI language (M-139). REMOTE is not a region; callers translate it. */
export function countryName(code, language) {
  return new Intl.DisplayNames([language], { type: 'region' }).of(code)
}
