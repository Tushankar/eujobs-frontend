import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'
import { Company } from '../modules/companies/companies.model.js'
import { Job } from '../modules/jobs/jobs.model.js'
import { Faq } from '../modules/meta/meta.model.js'
import { User } from '../modules/users/users.model.js'
import { seedCatalog } from '../seed/catalog.js'
import { api, auth, useTestDb } from './helpers/index.js'
import { approvedRecruiter, jobBody } from './helpers/market.js'
import { useFakePlaces } from './helpers/places.js'

useTestDb([User, Company, Job, Faq])
useFakePlaces()
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
