import { after, before, beforeEach } from 'node:test'
import { fieldError } from '../../lib/errors.js'
import { clearPlacesCache, setPlacesClient } from '../../modules/places/places.service.js'
import { PLACES } from '../../seed/data/places.js'

/* A fake Google Places client (§2.16: API tests never call Google). */
export const TORONTO = { countryCode: 'CA', city: 'Toronto', placeId: 'ChIJpTvG15DL1IkRd8S0KlBVNTI' }
const KNOWN = [...Object.values(PLACES), TORONTO]

/** Google's suggestion shape. */
export const suggestion = (placeId, main, secondary) => ({
  placePrediction: { placeId, structuredFormat: { mainText: { text: main }, ...(secondary && { secondaryText: { text: secondary } }) } },
})

/**
 * Installs the fake for this test file. `calls` records every Google call; set `fake.suggestions` for
 * autocomplete. Details know the seed cities plus Toronto (outside EU 27 + UK).
 */
export function useFakePlaces() {
  const calls = []
  const fake = {
    suggestions: [],
    async autocomplete(args) {
      calls.push({ kind: 'autocomplete', ...args })
      return fake.suggestions
    },
    async details(args) {
      calls.push({ kind: 'details', ...args })
      const place = KNOWN.find((known) => known.placeId === args.placeId)
      if (!place) throw fieldError({ placeId: 'invalid' })
      return {
        id: place.placeId,
        addressComponents: [
          { longText: place.city, shortText: place.city, types: ['locality', 'political'] },
          { longText: place.countryCode, shortText: place.countryCode, types: ['country', 'political'] },
        ],
      }
    },
  }
  before(() => setPlacesClient(fake))
  after(() => setPlacesClient())
  beforeEach(() => {
    calls.length = 0
    fake.suggestions = []
    clearPlacesCache()
  })
  return { calls, fake }
}
