import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, before, describe, it } from 'node:test'
import { config } from '../config/env.js'
import { setPlacesClient } from '../modules/places/places.service.js'
import { User } from '../modules/users/users.model.js'
import { seedCatalog } from '../seed/catalog.js'
import { PLACES } from '../seed/data/places.js'
import { api, auth, createUser, useTestDb } from './helpers/index.js'
import { suggestion, TORONTO, useFakePlaces } from './helpers/places.js'

useTestDb([User])
before(() => seedCatalog())
const { calls, fake } = useFakePlaces()

const autocomplete = (user, input, sessionToken = randomUUID()) =>
  api().get('/api/v1/places/autocomplete').query({ input, sessionToken }).set(auth(user))
const details = (user, placeId, sessionToken) => api().get(`/api/v1/places/${placeId}`).query(sessionToken ? { sessionToken } : {}).set(auth(user))

describe('GET /places/autocomplete (G-1, §2.16)', () => {
  it('keeps only EU 27 + UK suggestions, reading the country from the secondary text (P3-D1)', async () => {
    fake.suggestions = [
      suggestion(PLACES.london.placeId, 'London', 'UK'),
      suggestion('ChIJC5uNqA7yLogRlWsFmmnXxyg', 'London', 'ON, Canada'),
      suggestion('ChIJbVivV1pD65QRcfkUxqURrCM', 'Londrina', 'Paraná, Brazil'),
      suggestion('ChIJY5PQNOTdX0gRL_NVxyr6Ib0', 'Londonderry', 'UK'),
      suggestion('ChIJRyEiyiZ0lUcR8_example', 'Luxembourg'),
      suggestion('ChIJbern', 'Bern', 'Switzerland'),
    ]
    const res = await autocomplete(await createUser(), 'Lond')
    assert.equal(res.status, 200)
    assert.deepEqual(res.body.items, [
      { placeId: PLACES.london.placeId, city: 'London', secondary: 'UK' },
      { placeId: 'ChIJY5PQNOTdX0gRL_NVxyr6Ib0', city: 'Londonderry', secondary: 'UK' },
      { placeId: 'ChIJRyEiyiZ0lUcR8_example', city: 'Luxembourg', secondary: '' },
    ])
  })

  it('reads country names in the user language and passes language, session token and the Europe box', async () => {
    fake.suggestions = [
      suggestion(PLACES.london.placeId, 'Londres', 'Reino Unido'),
      suggestion('ChIJA8c2lxTNXIgRmMwHc-RRGWI', 'London', 'Kentucky, EE. UU.'),
      suggestion('ChIJpraga', 'Praga', 'Chequia'),
    ]
    const sessionToken = randomUUID()
    const res = await autocomplete(await createUser({ language: 'es' }), 'Lond', sessionToken)
    assert.deepEqual(res.body.items.map((item) => item.city), ['Londres', 'Praga'])
    assert.deepEqual(calls, [
      {
        kind: 'autocomplete',
        input: 'Lond',
        languageCode: 'es',
        sessionToken,
        locationRestriction: { rectangle: { low: { latitude: 27.5, longitude: -31.5 }, high: { latitude: 71, longitude: 35 } } },
      },
    ])
  })

  it('answers a repeated search from the cache, per language', async () => {
    fake.suggestions = [suggestion(PLACES.paris.placeId, 'Paris', 'France')]
    const user = await createUser()
    await autocomplete(user, 'Par')
    await autocomplete(user, 'PAR')
    assert.equal(calls.length, 1)
    await autocomplete(await createUser({ language: 'fr' }), 'Par')
    assert.equal(calls.length, 2)
  })

  it('validates the input and the session token', async () => {
    const user = await createUser()
    assert.deepEqual((await autocomplete(user, 'L')).body.error.fields, { input: 'too_short' })
    const res = await api().get('/api/v1/places/autocomplete').query({ input: 'Lond' }).set(auth(user))
    assert.deepEqual(res.body.error.fields, { sessionToken: 'required' })
    assert.equal(calls.length, 0)
  })

  it('limits each user to 60 searches a minute', async () => {
    const user = await createUser()
    for (let i = 0; i < 60; i++) assert.equal((await autocomplete(user, `City ${i}`)).status, 200)
    const limited = await autocomplete(user, 'One more')
    assert.equal(limited.status, 429)
    assert.equal(limited.body.error.code, 'RATE_LIMITED')
    assert.equal((await autocomplete(await createUser(), 'Other user')).status, 200)
  })

  it('needs a session, and a recruiter needs the email code first (U37)', async () => {
    assert.equal((await api().get('/api/v1/places/autocomplete').query({ input: 'Lond', sessionToken: randomUUID() })).status, 401)
    const recruiter = await createUser({ role: 'recruiter', status: 'unverified', emailVerifiedAt: null })
    assert.equal((await autocomplete(recruiter, 'Lond')).body.error.code, 'EMAIL_UNVERIFIED')
  })
})

describe('GET /places/:placeId (G-1)', () => {
  it('resolves a city in the user language and ends the typing session with the same token', async () => {
    const sessionToken = randomUUID()
    const res = await details(await createUser(), PLACES.warsaw.placeId, sessionToken)
    assert.equal(res.status, 200)
    assert.deepEqual(res.body, { placeId: PLACES.warsaw.placeId, city: 'Warsaw', countryCode: 'PL' })
    assert.deepEqual(calls, [{ kind: 'details', placeId: PLACES.warsaw.placeId, languageCode: 'en', sessionToken }])
  })

  it('refuses a place outside EU 27 + UK', async () => {
    const res = await details(await createUser(), TORONTO.placeId)
    assert.equal(res.status, 422)
    assert.deepEqual(res.body.error.fields, { placeId: 'not_allowed' })
  })

  it('limits each user to 30 lookups a minute', async () => {
    const user = await createUser()
    for (let i = 0; i < 30; i++) assert.equal((await details(user, PLACES.berlin.placeId)).status, 200)
    assert.equal((await details(user, PLACES.berlin.placeId)).status, 429)
  })
})

describe('the real Google client (fetch stubbed)', () => {
  const realFetch = globalThis.fetch
  const requests = []
  before(() => setPlacesClient())
  after(() => {
    globalThis.fetch = realFetch
    setPlacesClient(fake)
  })

  it('sends the key only in a header and answers a Google failure with PLACES_UNAVAILABLE', async () => {
    globalThis.fetch = async (url, init) => {
      requests.push({ url, init })
      return new Response(JSON.stringify({ error: { status: 'PERMISSION_DENIED' } }), { status: 403 })
    }
    const res = await autocomplete(await createUser(), 'Valletta')
    assert.equal(res.status, 503)
    assert.deepEqual(res.body, { error: { code: 'PLACES_UNAVAILABLE' } })
    assert.ok(!JSON.stringify(res.body).includes(config.googlePlacesApiKey))
    const [{ url, init }] = requests
    assert.equal(url, 'https://places.googleapis.com/v1/places:autocomplete')
    assert.equal(init.headers['X-Goog-Api-Key'], config.googlePlacesApiKey)
    assert.ok(!url.includes(config.googlePlacesApiKey))
    const body = JSON.parse(init.body)
    assert.deepEqual(body.includedPrimaryTypes, ['(cities)'])
    assert.equal(body.locationRestriction.rectangle.high.longitude, 35)
    assert.equal(body.includedRegionCodes, undefined)
  })

  it('asks place details for address components only (no coordinates)', async () => {
    globalThis.fetch = async (url, init) => {
      requests.push({ url, init })
      return new Response(JSON.stringify({ addressComponents: [] }), { status: 200 })
    }
    requests.length = 0
    await details(await createUser(), PLACES.lisbon.placeId)
    assert.equal(requests[0].init.headers['X-Goog-FieldMask'], 'id,addressComponents')
  })
})
