import { config } from '../../config/env.js'
import { AppError, fieldError } from '../../lib/errors.js'

/*
 * The real Google Places (New) client (§2.16), called with fetch. The key goes only into the request
 * header: never into a response, a log or an error. API tests replace this client (setPlacesClient).
 */
const BASE_URL = 'https://places.googleapis.com/v1'
const TIMEOUT_MS = 8000

async function call(url, { headers, ...init }) {
  let response
  try {
    response = await fetch(url, { ...init, headers: { 'X-Goog-Api-Key': config.googlePlacesApiKey, ...headers }, signal: AbortSignal.timeout(TIMEOUT_MS) })
  } catch (error) {
    console.error(`Google Places request failed: ${error.name}`)
    throw new AppError('PLACES_UNAVAILABLE')
  }
  return response
}

async function json(response, label) {
  if (!response.ok) {
    console.error(`Google Places ${label} failed: HTTP ${response.status}`)
    throw new AppError('PLACES_UNAVAILABLE')
  }
  return response.json()
}

export const googlePlaces = {
  /** City suggestions; returns Google's `suggestions` array. */
  async autocomplete({ input, languageCode, sessionToken, locationRestriction }) {
    const response = await call(`${BASE_URL}/places:autocomplete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input, languageCode, sessionToken, includedPrimaryTypes: ['(cities)'], locationRestriction }),
    })
    return (await json(response, 'autocomplete')).suggestions ?? []
  },

  /** One place with its address components only (no coordinates are requested). */
  async details({ placeId, languageCode, sessionToken }) {
    const query = new URLSearchParams({ languageCode, ...(sessionToken && { sessionToken }) })
    const response = await call(`${BASE_URL}/places/${encodeURIComponent(placeId)}?${query}`, {
      headers: { 'X-Goog-FieldMask': 'id,addressComponents' },
    })
    // An unknown or malformed id is the caller's mistake, not an outage.
    if (response.status === 400 || response.status === 404) throw fieldError({ placeId: 'invalid' })
    return json(response, 'details')
  },
}
