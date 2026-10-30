import { LIMITS } from '../../config/limits.js'
import { fieldError } from '../../lib/errors.js'
import { Country } from '../meta/meta.model.js'
import { googlePlaces } from './places.google.js'

/*
 * Places proxy (G-1, §2.16): city suggestions and place details in the user's language, EU 27 + UK only.
 * A place is stored as { countryCode, city, placeId }, never with coordinates.
 */

// P3-Q1: Google takes at most 15 region codes, so a fixed Europe rectangle (Cyprus, Malta, the Canary
// Islands, Madeira and the Azores included) fills the suggestions and the server keeps EU 27 + UK.
const EUROPE = { rectangle: { low: { latitude: 27.5, longitude: -31.5 }, high: { latitude: 71, longitude: 35 } } }
// P3-D1: Google's own short names that Intl.DisplayNames does not use.
const GOOGLE_COUNTRY_ALIASES = { en: { uk: 'GB' } }

let client = googlePlaces

/** Tests swap in a fake Google client; no argument restores the real one. */
export function setPlacesClient(fake) {
  client = fake ?? googlePlaces
}

function ttlCache(ttlMs) {
  const entries = new Map()
  return {
    get(key) {
      const entry = entries.get(key)
      if (entry && entry.expires > Date.now()) return entry.value
      entries.delete(key)
      return undefined
    },
    set(key, value) {
      entries.delete(key)
      entries.set(key, { value, expires: Date.now() + ttlMs })
      // Oldest out first (§2.16).
      if (entries.size > LIMITS.places.cache.maxEntries) entries.delete(entries.keys().next().value)
    },
    clear: () => entries.clear(),
  }
}

const suggestionCache = ttlCache(LIMITS.places.cache.autocompleteTtlMs)
const placeCache = ttlCache(LIMITS.places.cache.detailsTtlMs)

export function clearPlacesCache() {
  suggestionCache.clear()
  placeCache.clear()
}

/** EU 27 + UK: every enabled country row except Remote (M-139). */
async function allowedCountryCodes() {
  return (await Country.find({ enabled: true, isRemote: false }, 'code')).map((country) => country.code)
}

const normalize = (text) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim()

/** Country name in `language` → code, for the allowed countries. */
function countryCodesByName(codes, language) {
  const names = new Intl.DisplayNames([language], { type: 'region' })
  const byName = new Map(codes.map((code) => [normalize(names.of(code)), code]))
  for (const [alias, code] of Object.entries(GOOGLE_COUNTRY_ALIASES[language] ?? {})) if (codes.includes(code)) byName.set(alias, code)
  return byName
}

/** P3-D1: the last part of the secondary text names the country; a city-state has only its main text. */
function suggestionCountry({ structuredFormat }, byName) {
  const text = structuredFormat.secondaryText?.text || structuredFormat.mainText.text
  return byName.get(normalize(text.split(',').at(-1)))
}

export async function autocomplete({ input, language, sessionToken }) {
  const key = `${language}|${input.trim().toLowerCase()}`
  const cached = suggestionCache.get(key)
  if (cached) return cached
  const suggestions = await client.autocomplete({ input, languageCode: language, sessionToken, locationRestriction: EUROPE })
  const byName = countryCodesByName(await allowedCountryCodes(), language)
  const items = suggestions
    .map((suggestion) => suggestion.placePrediction)
    .filter((prediction) => prediction?.structuredFormat && suggestionCountry(prediction, byName))
    .map(({ placeId, structuredFormat }) => ({
      placeId,
      city: structuredFormat.mainText.text,
      secondary: structuredFormat.secondaryText?.text ?? '',
    }))
  suggestionCache.set(key, items)
  return items
}

/** One city as { placeId, city, countryCode }; a place outside EU 27 + UK is `not_allowed`. */
export async function placeDetails({ placeId, language, sessionToken }) {
  const key = `${language}|${placeId}`
  const cached = placeCache.get(key)
  if (cached) return cached
  const place = await client.details({ placeId, languageCode: language, sessionToken })
  const component = (type) => place.addressComponents?.find((part) => part.types.includes(type))
  const countryCode = component('country')?.shortText
  const city = (component('locality') ?? component('postal_town') ?? component('administrative_area_level_3'))?.longText
  if (!city || !(await allowedCountryCodes()).includes(countryCode)) throw fieldError({ placeId: 'not_allowed' })
  const result = { placeId, city, countryCode }
  placeCache.set(key, result)
  return result
}

/** The place a city field stores (§2.16): resolved through details, cached, never with coordinates. */
export async function resolvePlace(placeId, language) {
  const { city, countryCode } = await placeDetails({ placeId, language })
  return { countryCode, city, placeId }
}
