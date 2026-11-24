import { LIMITS } from '../../config/limits.js'
import { actorFor, recordAudit } from '../../lib/audit.js'
import { AppError, fieldError } from '../../lib/errors.js'
import { SECTORS } from '../../seed/data/sectors.js'
import { AgencyClient } from '../agencies/agencies.model.js'
import { Company } from '../companies/companies.model.js'
import { Job } from '../jobs/jobs.model.js'
import { Sector } from './meta.model.js'

/*
 * Job sectors (2026-11-24). The starter list is added where missing (server start, seed:catalog, tests), so the
 * admin's renames and hidden sectors survive. A company's or client's `industry` text keeps the sector's English
 * name, which the AI drafts and keyword searches read; a rename updates it.
 */
export async function ensureSectors() {
  await Sector.bulkWrite(SECTORS.map((sector) => ({ updateOne: { filter: { key: sector.key }, update: { $setOnInsert: sector }, upsert: true } })))
}

const dto = (sector) => ({ key: sector.key, name: { en: sector.name.en, es: sector.name.es, fr: sector.name.fr }, hidden: sector.hidden })

/** GET /meta/sectors: every sector, hidden ones flagged (they still name the jobs that have them). */
export async function listSectors() {
  return (await Sector.find().sort({ 'name.en': 1 })).map(dto)
}

/** A sector key a form may save: one that exists and is shown, or the value the record already has. */
export async function checkSector(key, field, current) {
  if (!key || key === current) return
  if (!(await Sector.exists({ key, hidden: false }))) throw fieldError({ [field]: 'invalid' })
}

/**
 * The stored fields of a company's or agency client's sector: the key and, as `industry`, the sector's English name.
 * No key keeps an older typed industry until a sector is picked; a removed sector removes both.
 */
export async function sectorFields(key, field, current) {
  if (!key) return current ? { sector: undefined, industry: undefined } : {}
  await checkSector(key, field, current)
  return { sector: key, industry: (await Sector.findOne({ key }, 'name')).name.en }
}

/* ---------- admin › Website › Sectors (`content.view` / `content.manage`) ---------- */

/** Every sector with how many jobs (live ones too), companies and agency clients use it. */
export async function adminList() {
  const count = (Model, match = {}) => Model.aggregate([{ $match: { sector: { $ne: null }, ...match } }, { $group: { _id: '$sector', count: { $sum: 1 } } }])
  const [sectors, jobs, live, companies, clients] = await Promise.all([Sector.find().sort({ 'name.en': 1 }), count(Job), count(Job, { status: 'published' }), count(Company), count(AgencyClient)])
  const by = (rows) => new Map(rows.map((row) => [row._id, row.count]))
  const [jobsOf, liveOf, companiesOf, clientsOf] = [jobs, live, companies, clients].map(by)
  const items = sectors.map((sector) => ({
    ...dto(sector),
    jobs: jobsOf.get(sector.key) ?? 0,
    liveJobs: liveOf.get(sector.key) ?? 0,
    companies: (companiesOf.get(sector.key) ?? 0) + (clientsOf.get(sector.key) ?? 0),
  }))
  return { items, total: items.length }
}

const sameName = (a, b) => a.trim().toLocaleLowerCase('en') === b.trim().toLocaleLowerCase('en')

/** No two sectors share an English name. */
async function assertUniqueName(name, except) {
  const all = await Sector.find(except ? { key: { $ne: except } } : {}, 'name')
  if (all.some((sector) => sameName(sector.name.en, name.en))) throw fieldError({ 'name.en': 'duplicate' })
}

/** A permanent key from the English name ("Green Energy" → green_energy), numbered when taken. */
async function newKey(english) {
  const base =
    english
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 40) || 'sector'
  let key = base
  for (let index = 2; await Sector.exists({ key }); index++) key = `${base}_${index}`
  return key
}

const audit = (admin, sector, type) =>
  recordAudit({ type: `content.${type}`, category: 'content', actor: actorFor(admin), target: { type: 'sector', id: sector._id }, params: { title: sector.name.en } })

export async function create(admin, { name }) {
  if ((await Sector.countDocuments()) >= LIMITS.sector.max) throw fieldError({ 'name.en': 'too_many' }, { max: LIMITS.sector.max })
  await assertUniqueName(name)
  const sector = await Sector.create({ key: await newKey(name.en), name })
  await audit(admin, sector, 'sector_created')
  return dto(sector)
}

/** Names and/or shown-or-hidden; a new English name is copied to the companies and clients that have the sector. */
export async function update(admin, key, { name, hidden }) {
  const sector = await Sector.findOne({ key })
  if (!sector) throw new AppError('NOT_FOUND')
  if (name) {
    await assertUniqueName(name, key)
    const renamed = name.en !== sector.name.en
    sector.name = name
    if (renamed) await Promise.all([Company.updateMany({ sector: key }, { industry: name.en }), AgencyClient.updateMany({ sector: key }, { industry: name.en })])
  }
  const visibility = hidden !== undefined && hidden !== sector.hidden
  if (hidden !== undefined) sector.hidden = hidden
  await sector.save()
  if (name) await audit(admin, sector, 'sector_updated')
  if (visibility) await audit(admin, sector, hidden ? 'sector_hidden' : 'sector_shown')
  return dto(sector)
}
