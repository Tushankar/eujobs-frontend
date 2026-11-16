/*
 * The EU 27 (worldwide platform, owner 2026-11-16: "EU Jobs" first, then the world) and right-to-work regions. A
 * right-to-work entry is for one country (its ISO code) or for the whole EU ('EU'); before 2026-11-16 the regions were
 * 'eu' and 'uk' (scripts/migrateRightToWork.js renames them, and they are still read here).
 */
export const EU_COUNTRIES = ['AT', 'BE', 'BG', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR', 'HU', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK']

const LEGACY_REGIONS = { eu: 'EU', uk: 'GB' }

/** A stored region in today's form: 'EU' or a country code. */
export const normalizeRegion = (region) => LEGACY_REGIONS[region] ?? region

/** Whether a right-to-work region covers work in `countryCode` (the EU group covers each of the 27). */
export function regionCovers(region, countryCode) {
  const current = normalizeRegion(region)
  return current === 'EU' ? EU_COUNTRIES.includes(countryCode) : current === countryCode
}
