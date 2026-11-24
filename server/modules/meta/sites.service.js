import { config } from '../../config/env.js'
import { actorFor, recordAudit } from '../../lib/audit.js'
import { AppError, fieldError } from '../../lib/errors.js'
import { SITES } from '../../seed/data/sites.js'
import { Job } from '../jobs/jobs.model.js'
import { visibleFilter } from '../jobs/jobs.search.js'
import { Site } from './meta.model.js'
import { checkSectors } from './sectors.service.js'

/*
 * The sector sites (2026-11-24). One frontend runs on every domain: on a site's domain the landing page and /jobs show
 * only that site's jobs under its own hero line; everything that needs an account opens on the main site
 * (CLIENT_ORIGIN, eujobs.careers). The starter rows are added where missing, so admin edits survive.
 */
export async function ensureSites() {
  await Site.bulkWrite(SITES.map((site) => ({ updateOne: { filter: { host: site.host }, update: { $setOnInsert: site }, upsert: true } })))
}

/** "WWW.EUjobs.Health:443" → "eujobs.health". */
export const normalizeHost = (host) =>
  String(host ?? '')
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, '')
    .replace(/^www\./, '')

// The active sites, read again after an admin change or after a minute (other processes).
const CACHE_MS = 60_000
let cached = null
function forget() {
  cached = null
}

export async function activeSites() {
  if (!cached || cached.at < Date.now() - CACHE_MS) {
    const sites = Site.find({ active: true }).lean().exec()
    cached = { at: Date.now(), sites }
    sites.catch(forget)
  }
  return cached.sites
}

export async function siteByHost(host) {
  const key = normalizeHost(host)
  return key ? ((await activeSites()).find((site) => site.host === key) ?? null) : null
}

/** Whether a visible job belongs on `site`: in its sectors or employment types (either; none of both = all), remote if asked. */
export function jobOnSite(site, job) {
  if (site.remoteOnly && job.workPreference !== 'remote') return false
  const bySector = site.sectors.length > 0
  const byType = site.employmentTypes.length > 0
  if (!bySector && !byType) return true
  return (bySector && site.sectors.includes(job.sector)) || (byType && site.employmentTypes.includes(job.employmentType))
}

/** A job's home: the first site that lists it, sector and type sites before remote-only ones; null = the main site. */
export function homeHost(job, sites) {
  const ordered = [...sites].sort((a, b) => Number(a.remoteOnly) - Number(b.remoteOnly) || a.host.localeCompare(b.host))
  return ordered.find((site) => jobOnSite(site, job))?.host ?? null
}

/** CORS (2026-11-24): the main site and every active site, with and without "www.". */
export async function allowedOrigin(origin) {
  if (!origin || origin === config.clientOrigin) return true
  let url
  try {
    url = new URL(origin)
  } catch {
    return false
  }
  return url.protocol === 'https:' && Boolean(await siteByHost(url.host))
}

const publicDto = (site) => ({
  host: site.host,
  sectors: site.sectors,
  employmentTypes: site.employmentTypes,
  remoteOnly: site.remoteOnly,
  title: { en: site.title.en, es: site.title.es, fr: site.title.fr },
  text: { en: site.text.en, es: site.text.es, fr: site.text.fr },
})

/** GET /meta/site?host=: the site on this domain (null on the main site) and where the main site is. */
export async function currentSite(host) {
  const site = await siteByHost(host)
  return { mainOrigin: config.clientOrigin, site: site ? publicDto(site) : null }
}

/* ---------- admin › Website › Sites (`content.view` / `content.manage`) ---------- */

const adminDto = (site, liveJobs) => ({ ...publicDto(site), active: site.active, liveJobs, updatedAt: site.updatedAt })

/** Every site with how many live jobs it lists now. */
export async function adminList() {
  const [sites, jobs] = await Promise.all([Site.find().sort({ host: 1 }), visibleJobs()])
  const items = sites.map((site) => adminDto(site, jobs.filter((job) => jobOnSite(site, job)).length))
  return { items, total: items.length }
}

const visibleJobs = async () => Job.find(await visibleFilter(), 'sector employmentType workPreference').lean()

const audit = (admin, site, type) => recordAudit({ type: `content.${type}`, category: 'content', actor: actorFor(admin), target: { type: 'site', id: site._id }, params: { title: site.host } })

/** The main site's own host is not a sector site. */
function checkHost(host) {
  if (host === normalizeHost(new URL(config.clientOrigin).host)) throw fieldError({ host: 'main_site' })
}

export async function create(admin, body) {
  const host = normalizeHost(body.host)
  checkHost(host)
  if (await Site.exists({ host })) throw fieldError({ host: 'duplicate' })
  const site = await Site.create({ ...body, host, sectors: await checkSectors(body.sectors, 'sectors') })
  forget()
  await audit(admin, site, 'site_created')
  const jobs = await visibleJobs()
  return adminDto(site, jobs.filter((job) => jobOnSite(site, job)).length)
}

export async function update(admin, host, body) {
  const site = await Site.findOne({ host: normalizeHost(host) })
  if (!site) throw new AppError('NOT_FOUND')
  if (body.sectors) body.sectors = await checkSectors(body.sectors, 'sectors', site.sectors)
  const activeChanged = body.active !== undefined && body.active !== site.active
  site.set(body)
  await site.save()
  forget()
  await audit(admin, site, activeChanged ? (site.active ? 'site_activated' : 'site_deactivated') : 'site_updated')
  const jobs = await visibleJobs()
  return adminDto(site, jobs.filter((job) => jobOnSite(site, job)).length)
}
