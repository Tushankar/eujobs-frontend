import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'
import { AuditEvent } from '../modules/admin/admin.model.js'
import { AgencyClient } from '../modules/agencies/agencies.model.js'
import { Company } from '../modules/companies/companies.model.js'
import { Job } from '../modules/jobs/jobs.model.js'
import { Sector } from '../modules/meta/meta.model.js'
import { ensureSectors } from '../modules/meta/sectors.service.js'
import { User } from '../modules/users/users.model.js'
import { seedCatalog } from '../seed/catalog.js'
import { SECTORS } from '../seed/data/sectors.js'
import { api, auth, createUser, useTestDb } from './helpers/index.js'
import { approvedAgency, approvedRecruiter, jobBody } from './helpers/market.js'
import { useFakePlaces } from './helpers/places.js'

/* Job sectors (2026-11-24): the starter list, admin › Website › Sectors, and sectors on jobs, companies and clients. */
useTestDb([User, Company, Job, AgencyClient, AuditEvent, Sector])
useFakePlaces()
before(() => seedCatalog())

const v1 = '/api/v1'
const admin = (permissions) => createUser({ role: 'admin', ...(permissions ? { adminAccess: { granted: permissions } } : { isOwner: true }) })
const sectors = () => api().get(`${v1}/meta/sectors`)
const adminList = (user) => api().get(`${v1}/admin/content/sectors`).set(auth(user))
const addSector = (user, name) => api().post(`${v1}/admin/content/sectors`).set(auth(user)).send({ name })
const editSector = (user, key, body) => api().patch(`${v1}/admin/content/sectors/${key}`).set(auth(user)).send(body)
const createJob = (user, body) => api().post(`${v1}/recruiter/jobs`).set(auth(user)).send(body)
const publish = (user, id) => api().patch(`${v1}/recruiter/jobs/${id}/status`).set(auth(user)).send({ status: 'published' })
const GREEN = { en: 'Green Energy', es: 'Energía verde', fr: 'Énergie verte' }

describe('job sectors', () => {
  it('lists the starter sectors to everyone, keeps admin changes when added again', async () => {
    await ensureSectors()
    const list = (await sectors()).body.items
    assert.equal(list.length, SECTORS.length)
    assert.deepEqual(list.find((sector) => sector.key === 'healthcare'), { key: 'healthcare', name: { en: 'Healthcare', es: 'Sanidad', fr: 'Santé' }, hidden: false })

    await Sector.updateOne({ key: 'legal' }, { 'name.en': 'Law', hidden: true })
    await ensureSectors()
    const legal = (await sectors()).body.items.find((sector) => sector.key === 'legal')
    assert.deepEqual([legal.name.en, legal.hidden], ['Law', true])
  })

  it('lets content admins add, rename and hide sectors, with counts and audit events', async () => {
    await ensureSectors()
    const owner = await admin()
    const viewer = await admin(['content.view'])
    assert.equal((await addSector(viewer, GREEN)).status, 403)

    const created = await addSector(owner, GREEN)
    assert.equal(created.status, 201, JSON.stringify(created.body))
    assert.deepEqual(created.body, { key: 'green_energy', name: GREEN, hidden: false })
    assert.deepEqual((await addSector(owner, { ...GREEN, en: ' green energy ' })).body.error.fields, { 'name.en': 'duplicate' })
    assert.equal((await addSector(owner, { ...GREEN, fr: '' })).status, 422)

    // A company and a client in the sector keep its English name as their industry; a rename updates it.
    const { user: recruiter, company } = await approvedRecruiter()
    const saved = await api().patch(`${v1}/recruiter/company`).set(auth(recruiter)).send({ displayName: company.displayName, sector: 'green_energy', size: '11_50', placeId: company.location.placeId, website: 'https://example.com', description: 'We build calm software.' })
    assert.equal(saved.status, 200, JSON.stringify(saved.body))
    assert.deepEqual([saved.body.sector, saved.body.industry], ['green_energy', 'Green Energy'])
    const { user: agency } = await approvedAgency()
    const client = await api().post(`${v1}/agency/clients`).set(auth(agency)).send({ name: 'Solar Co', sector: 'green_energy' })
    assert.deepEqual([client.body.sector, client.body.industry], ['green_energy', 'Green Energy'])
    const job = await createJob(recruiter, jobBody({ sector: 'green_energy' }))
    assert.equal((await publish(recruiter, job.body.id)).status, 200)

    const renamed = await editSector(owner, 'green_energy', { name: { ...GREEN, en: 'Renewable Energy' } })
    assert.equal(renamed.body.key, 'green_energy')
    assert.equal((await Company.findById(company._id)).industry, 'Renewable Energy')
    assert.equal((await AgencyClient.findById(client.body.id)).industry, 'Renewable Energy')

    const row = (await adminList(viewer)).body.items.find((sector) => sector.key === 'green_energy')
    assert.deepEqual([row.jobs, row.liveJobs, row.companies], [1, 1, 2])

    assert.equal((await editSector(owner, 'green_energy', { hidden: true })).body.hidden, true)
    const types = (await AuditEvent.find({ target: { $exists: true }, 'target.type': 'sector' }).sort({ at: 1 })).map((event) => event.type)
    assert.deepEqual(types, ['content.sector_created', 'content.sector_updated', 'content.sector_hidden'])
    assert.equal((await editSector(owner, 'nope', { hidden: true })).status, 404)
  })

  it('needs a shown sector to publish; a job keeps a sector hidden after it was picked', async () => {
    await ensureSectors()
    const { user } = await approvedRecruiter()
    assert.deepEqual((await createJob(user, jobBody({ sector: 'unknown' }))).body.error.fields, { sector: 'invalid' })

    const draft = await createJob(user, jobBody({ sector: null }))
    const refused = await publish(user, draft.body.id)
    assert.deepEqual([refused.status, refused.body.error.params.step, Object.keys(refused.body.error.fields)], [422, 'basics', ['sector']])

    const job = await createJob(user, jobBody({ sector: 'healthcare' }))
    assert.equal(job.body.sector, 'healthcare')
    await Sector.updateOne({ key: 'healthcare' }, { hidden: true })
    const kept = await api().put(`${v1}/recruiter/jobs/${job.body.id}`).set(auth(user)).send(jobBody({ sector: 'healthcare', title: 'Ward nurse' }))
    assert.equal(kept.status, 200, JSON.stringify(kept.body))
    assert.deepEqual((await createJob(user, jobBody({ sector: 'healthcare' }))).body.error.fields, { sector: 'invalid' })
    await Sector.updateOne({ key: 'healthcare' }, { hidden: false })
  })

  it('keeps no salary on a volunteer job, and agencies cannot post one', async () => {
    await ensureSectors()
    const { user } = await approvedRecruiter()
    const job = await createJob(user, jobBody({ employmentType: 'volunteer', sector: 'charity_nonprofit' }))
    assert.equal(job.status, 201, JSON.stringify(job.body))
    assert.deepEqual([job.body.employmentType, job.body.salary], ['volunteer', null])
    assert.equal((await publish(user, job.body.id)).status, 200)

    const { user: agency } = await approvedAgency()
    assert.deepEqual((await createJob(agency, jobBody({ employmentType: 'volunteer', salary: null }))).body.error.fields, { employmentType: 'not_allowed' })
  })
})
