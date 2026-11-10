import { fieldError } from '../../lib/errors.js'
import { allowedCountryCodes, normalize } from './places.service.js'

/*
 * Testing stand-in for Google Places (PLACES_MANUAL=true): a city field takes what was typed as
 * "City Country". The country is the start of its name in the user's language, its two-letter code or
 * "UK". The place id carries the country code and the city, so nothing is looked up and no Google call is made.
 */
const ID = /^manual-([A-Z]{2})-([\w-]+)$/

export const manualPlaces = {
  /** Suggestions (Google's shape) for every way the last words start an allowed country; the comma is optional. */
  async autocomplete({ input, languageCode }) {
    const words = input.split(/[\s,]+/).filter(Boolean)
    const names = new Intl.DisplayNames([languageCode], { type: 'region' })
    const codes = await allowedCountryCodes()
    const suggestions = new Map()
    for (let at = 1; at < words.length; at++) {
      const city = words.slice(0, at).join(' ')
      const typed = normalize(words.slice(at).join(' '))
      const country = typed === 'uk' ? 'gb' : typed
      if (country.length < 2) continue
      for (const code of codes) {
        if (code.toLowerCase() !== country && !normalize(names.of(code)).startsWith(country)) continue
        const placeId = `manual-${code}-${Buffer.from(city).toString('base64url')}`
        suggestions.set(placeId, { placePrediction: { placeId, structuredFormat: { mainText: { text: city }, secondaryText: { text: names.of(code) } } } })
      }
    }
    return [...suggestions.values()]
  },

  async details({ placeId }) {
    const [, code, city] = ID.exec(placeId) ?? []
    if (!code) throw fieldError({ placeId: 'invalid' })
    return {
      id: placeId,
      addressComponents: [
        { longText: Buffer.from(city, 'base64url').toString(), types: ['locality'] },
        { shortText: code, types: ['country'] },
      ],
    }
  },
}
