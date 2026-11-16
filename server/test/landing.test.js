import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'
import { Company } from '../modules/companies/companies.model.js'
import { Job } from '../modules/jobs/jobs.model.js'
import { Faq } from '../modules/meta/meta.model.js'
import { User } from '../modules/users/users.model.js'
import { seedCatalog } from '../seed/catalog.js'
import { api, auth, useTestDb } from './helpers/index.js'
import { approvedRecruiter, jobBody } from './helpers/market.js'
import { MOSCOW, TORONTO, useFakePlaces } from './helpers/places.js'
import { PLACES } from '../seed/data/places.js'

useTestDb([User, Company, Job, Faq])
const places = useFakePlaces()
before(() => seedCatalog())

async function publish(user, body) {
  const created = await api().post('/api/v1/recruiter/jobs').set(auth(user)).send(jobBody(body))
  await api().patch(`/api/v1/recruiter/jobs/${created.body.id}/status`).set(auth(user)).send({ status: 'published' })
  return created.body.id
}

describe('GET /landing (public home page)', () => {
  it('answers without a session with the newest visible jobs, live counts and candidate FAQs', async () => {
    const { user } = await approvedRecruiter()
    const older = await publish(user, { title: 'Data Analyst', employmentType: 'contract', workPreference: 'on_site' })
    const newer = await publish(user, { title: 'Frontend Engineer' })
    // A draft never shows.
    await api().post('/api/v1/recruiter/jobs').set(auth(user)).send(jobBody({ title: 'Secret Draft' }))
    await Faq.create([
      { audiences: ['candidate'], order: 1, question: { en: 'Is it free?', es: '¿Es gratis?', fr: 'Est-ce gratuit ?' }, answer: { en: 'Yes.', es: 'Sí.', fr: 'Oui.' } },
      { audiences: ['recruiter'], order: 2, question: { en: 'Recruiter only', es: 'R', fr: 'R' }, answer: { en: 'R', es: 'R', fr: 'R' } },
    ])

    const res = await api().get('/api/v1/landing?language=es')
    assert.equal(res.status, 200, JSON.stringify(res.body))
    assert.equal(res.body.total, 2)
    assert.deepEqual(res.body.jobs.map((job) => job.id), [newer, older])
    const [card] = res.body.jobs
    assert.equal(card.title, 'Frontend Engineer')
    assert.ok(card.company.name)
    assert.deepEqual([card.employmentType, card.workPreference, card.experienceYears], ['full_time', 'hybrid', 5])
    assert.equal(card.salary.max, 80000)
    assert.equal(res.body.counts.workPreference.hybrid, 1)
    assert.equal(res.body.counts.workPreference.on_site, 1)
    assert.equal(res.body.counts.employmentType.contract, 1)
    assert.deepEqual(res.body.faqs.map((faq) => faq.question), ['¿Es gratis?'])
  })

  it('refuses an unknown language', async () => {
    assert.equal((await api().get('/api/v1/landing?language=xx')).status, 422)
  })
})

describe('GET /landing/jobs (public job list, owner 2026-11-16)', () => {
  it('lists every visible job without a session, with tab counts that follow the keywords and the place', async () => {
    const { user } = await approvedRecruiter()
    const remote = await publish(user, { title: 'Remote Designer', workPreference: 'remote', placeId: null, remoteCountries: [] })
    const london = await publish(user, { title: 'London Analyst', employmentType: 'contract', workPreference: 'on_site', placeId: PLACES.london.placeId })
    await api().post('/api/v1/recruiter/jobs').set(auth(user)).send(jobBody({ title: 'Secret Draft' }))

    const all = (await api().get('/api/v1/landing/jobs')).body
    assert.deepEqual([all.total, all.items.length, all.counts.workPreference.remote, all.counts.employmentType.contract], [2, 2, 1, 1])
    assert.ok(all.items[0].company.displayName && Array.isArray(all.items[0].requiredSkills))

    const tab = (await api().get('/api/v1/landing/jobs?workPreference=remote')).body
    assert.deepEqual([tab.total, tab.items.map((job) => job.id)], [2, [remote]])
    const place = (await api().get('/api/v1/landing/jobs?location=royaume-uni&language=fr')).body
    assert.deepEqual([place.total, place.items.map((job) => job.id), place.counts.workPreference.remote], [1, [london], 0])
    assert.deepEqual((await api().get('/api/v1/landing/jobs?q=designer')).body.items.map((job) => job.id), [remote])
    assert.equal((await api().get('/api/v1/landing/jobs?employmentType=nope')).status, 422)
  })
})

describe('GET /landing/near ("Use my current location" in the job search)', () => {
  it('answers the city at a point in an enabled country, and nulls in a disabled one or when nothing is found', async () => {
    places.fake.near = PLACES.london
    const res = await api().get('/api/v1/landing/near?latitude=51.5&longitude=-0.12&language=fr')
    assert.deepEqual([res.status, res.body], [200, { city: 'London', countryCode: 'GB' }])
    assert.deepEqual(places.calls.at(-1), { kind: 'nearby', latitude: 51.5, longitude: -0.12, languageCode: 'fr' })

    places.fake.near = TORONTO
    assert.deepEqual((await api().get('/api/v1/landing/near?latitude=43.6&longitude=-79.4')).body, { city: 'Toronto', countryCode: 'CA' })
    places.fake.near = MOSCOW
    assert.deepEqual((await api().get('/api/v1/landing/near?latitude=55.7&longitude=37.6')).body, { city: null, countryCode: null })
    places.fake.near = null
    assert.deepEqual((await api().get('/api/v1/landing/near?latitude=0&longitude=0')).body, { city: null, countryCode: null })
    assert.equal((await api().get('/api/v1/landing/near?latitude=91&longitude=0')).status, 422)
  })
})
