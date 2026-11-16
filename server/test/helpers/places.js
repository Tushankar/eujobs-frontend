import { after, before, beforeEach } from 'node:test'
import { fieldError } from '../../lib/errors.js'
import { clearPlacesCache, setPlacesClient } from '../../modules/places/places.service.js'
import { PLACES } from '../../seed/data/places.js'

/* A fake Google Places client (§2.16: API tests never call Google). */
export const TORONTO = { countryCode: 'CA', city: 'Toronto', placeId: 'ChIJpTvG15DL1IkRd8S0KlBVNTI' }
// Worldwide since 2026-11-16, so "outside the platform" is a disabled country (owner decision pending on sanctions).
export const MOSCOW = { countryCode: 'RU', city: 'Moscow', placeId: 'ChIJybDUc_xKtUYRTM9XV8zWRD0' }
const KNOWN = [...Object.values(PLACES), TORONTO, MOSCOW]

/** Google's suggestion shape. */
export const suggestion = (placeId, main, secondary) => ({
  placePrediction: { placeId, structuredFormat: { mainText: { text: main }, ...(secondary && { secondaryText: { text: secondary } }) } },
})

/**
 * Installs the fake for this test file. `calls` records every Google call; set `fake.suggestions` for
 * autocomplete and `fake.near` (a known place) for the nearby search. Details know the seed cities, Toronto and
 * Moscow (a disabled country).
 */
export function useFakePlaces() {
  const calls = []
  const components = (place) => [
    { longText: place.city, shortText: place.city, types: ['locality', 'political'] },
    { longText: place.countryCode, shortText: place.countryCode, types: ['country', 'political'] },
  ]
  const fake = {
    suggestions: [],
    near: null,
    async nearby(args) {
      calls.push({ kind: 'nearby', ...args })
      // Like Google: the nearest place's street number comes first and has no types.
      return fake.near && { addressComponents: [{ longText: '114', shortText: '114' }, ...components(fake.near)] }
    },
    async autocomplete(args) {
      calls.push({ kind: 'autocomplete', ...args })
      return fake.suggestions
    },
    async details(args) {
      calls.push({ kind: 'details', ...args })
      const place = KNOWN.find((known) => known.placeId === args.placeId)
      if (!place) throw fieldError({ placeId: 'invalid' })
      return { id: place.placeId, addressComponents: components(place) }
    },
  }
  before(() => setPlacesClient(fake))
  after(() => setPlacesClient())
  beforeEach(() => {
    calls.length = 0
    fake.suggestions = []
    fake.near = null
    clearPlacesCache()
  })
  return { calls, fake }
}
