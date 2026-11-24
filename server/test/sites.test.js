import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'
import { config } from '../config/env.js'
import { AuditEvent } from '../modules/admin/admin.model.js'
import { Company } from '../modules/companies/companies.model.js'
import { Job } from '../modules/jobs/jobs.model.js'
import { Site } from '../modules/meta/meta.model.js'
import { ensureSectors } from '../modules/meta/sectors.service.js'
import { ensureSites, homeHost, jobOnSite } from '../modules/meta/sites.service.js'
import { User } from '../modules/users/users.model.js'
import { seedCatalog } from '../seed/catalog.js'
import { SITES } from '../seed/data/sites.js'
import { api, auth, createUser, useTestDb } from './helpers/index.js'
import { approvedRecruiter, jobBody } from './helpers/market.js'
import { useFakePlaces } from './helpers/places.js'

/* The sector sites (2026-11-24): eujobs.health and friends list their own jobs; eujobs.careers is the main site. */
useTestDb([User, Company, Job, AuditEvent, Site])
useFakePlaces()
before(() => seedCatalog())

const v1 = '/api/v1'
const owner = () => createUser({ role: 'admin', isOwner: true })

async function market() {
  await Promise.all([ensureSectors(), ensureSites()])
  const { user } = await approvedRecruiter()
  const post = async (body) => {
    const draft = await api().post(`${v1}/recruiter/jobs`).set(auth(user)).send(jobBody(body))
    const live = await api().patch(`${v1}/recruiter/jobs/${draft.body.id}/status`).set(auth(user)).send({ status: 'published' })
    assert.equal(live.status, 200, JSON.stringify(live.body))
    return live.body
  }
  return {
    nurse: await post({ title: 'Ward Nurse', sector: 'healthcare' }),
    remoteNurse: await post({ title: 'Telehealth Nurse', sector: 'healthcare', workPreference: 'remote', placeId: null }),
    volunteer: await post({ title: 'Food Bank Helper', sector: 'logistics_transport', employmentType: 'volunteer', salary: null }),
    designer: await post({ title: 'Product Designer', sector: 'it_software' }),
  }
}

describe('sector sites', () => {
  it('serves the site of a domain (www and case ignored) and the main site', async () => {
    await ensureSites()
    const health = (await api().get(`${v1}/meta/site?host=WWW.EUjobs.Health`)).body
    assert.equal(health.mainOrigin, config.clientOrigin)
    assert.deepEqual([health.site.host, health.site.sectors, health.site.title.en], ['eujobs.health', ['healthcare'], 'Find a Healthcare Job'])
    assert.deepEqual((await api().get(`${v1}/meta/site?host=localhost:5173`)).body.site, null)
    assert.equal((await Site.countDocuments()), SITES.length)
  })

  it('lists only the site’s jobs on its landing page and job list, each job with its home site', async () => {
    const { nurse, remoteNurse, volunteer, designer } = await market()
    const ids = async (query) => (await api().get(`${v1}/landing/jobs${query}`)).body.items.map((job) => job.title).sort()
    assert.deepEqual(await ids('?site=eujobs.health'), ['Telehealth Nurse', 'Ward Nurse'])
    assert.deepEqual(await ids('?site=eujobs.foundation'), ['Food Bank Helper'])
    assert.deepEqual(await ids('?site=eujobs.online'), ['Telehealth Nurse'])
    assert.equal((await ids('')).length, 4)
    const landing = (await api().get(`${v1}/landing?site=eujobs.tech`)).body
    assert.deepEqual([landing.total, landing.counts.sector, landing.jobs.map((job) => job.title)], [1, { it_software: 1 }, ['Product Designer']])

    const homes = Object.fromEntries((await api().get(`${v1}/landing/jobs`)).body.items.map((job) => [job.title, job.homeHost]))
    // A remote nurse lives on the health site before the remote one; a job no site lists lives on the main site.
    assert.deepEqual(homes, { 'Ward Nurse': 'eujobs.health', 'Telehealth Nurse': 'eujobs.health', 'Food Bank Helper': 'eujobs.foundation', 'Product Designer': 'eujobs.tech' })
    assert.equal(homeHost({ sector: 'legal', employmentType: 'full_time', workPreference: 'hybrid' }, await Site.find().lean()), null)
    assert.equal(jobOnSite({ sectors: [], employmentTypes: [], remoteOnly: false }, designer), true)
    assert.ok([nurse, remoteNurse, volunteer].every(Boolean))
  })

  it('lets the API answer the main site and active sites only (CORS)', async () => {
    await ensureSites()
    const origin = async (value) => (await api().get(`${v1}/health`).set('Origin', value)).headers['access-control-allow-origin']
    assert.equal(await origin(config.clientOrigin), config.clientOrigin)
    assert.equal(await origin('https://eujobs.health'), 'https://eujobs.health')
    assert.equal(await origin('https://www.eujobs.art'), 'https://www.eujobs.art')
    assert.equal(await origin('http://eujobs.health'), undefined)
    assert.equal(await origin('https://evil.example'), undefined)
  })

  it('lets content admins add, edit and switch off sites; the main site and duplicates are refused', async () => {
    await ensureSites()
    const admin = await owner()
    const text = { en: 'Green energy jobs across Europe.', es: 'Empleos de energía verde en Europa.', fr: 'Des offres en énergie verte en Europe.' }
    const title = { en: 'Find a Green Job', es: 'Encuentra empleo verde', fr: 'Trouvez un emploi vert' }
    const created = await api().post(`${v1}/admin/content/sites`).set(auth(admin)).send({ host: 'www.EUjobs.green', sectors: ['science_research'], title, text })
    assert.equal(created.status, 201, JSON.stringify(created.body))
    assert.deepEqual([created.body.host, created.body.active, created.body.liveJobs], ['eujobs.green', true, 0])
    const duplicate = await api().post(`${v1}/admin/content/sites`).set(auth(admin)).send({ host: 'eujobs.green', title, text })
    assert.deepEqual(duplicate.body.error.fields, { host: 'duplicate' })
    // The main site as production has it (the test origin is localhost, which is no domain).
    const testOrigin = config.clientOrigin
    config.clientOrigin = 'https://eujobs.careers'
    try {
      assert.deepEqual((await api().post(`${v1}/admin/content/sites`).set(auth(admin)).send({ host: 'www.eujobs.careers', title, text })).body.error.fields, { host: 'main_site' })
    } finally {
      config.clientOrigin = testOrigin
    }
    assert.deepEqual((await api().post(`${v1}/admin/content/sites`).set(auth(admin)).send({ host: 'eujobs.bad', sectors: ['nope'], title, text })).body.error.fields, { sectors: 'invalid' })

    const off = await api().patch(`${v1}/admin/content/sites/eujobs.green`).set(auth(admin)).send({ active: false, remoteOnly: true })
    assert.deepEqual([off.body.active, off.body.remoteOnly], [false, true])
    assert.equal((await api().get(`${v1}/meta/site?host=eujobs.green`)).body.site, null)
    const list = (await api().get(`${v1}/admin/content/sites`).set(auth(admin))).body
    assert.equal(list.total, SITES.length + 1)
    const types = (await AuditEvent.find({ 'target.type': 'site' }).sort({ at: 1 })).map((event) => event.type)
    assert.deepEqual(types, ['content.site_created', 'content.site_deactivated'])
  })
})
