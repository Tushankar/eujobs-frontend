import { LIMITS } from '../../config/limits.js'
import { AppError, fieldError } from '../../lib/errors.js'
import { removeFiles, signedUrl, storeFile } from '../../lib/files.js'
import { reencodeImage } from '../../lib/images.js'
import { searchText } from '../../lib/skills.js'
import { sanitizeSvg } from '../../lib/svg.js'
import { Company } from '../companies/companies.model.js'
import { logoUrls } from '../companies/companies.service.js'
import { File } from '../files/files.model.js'
import { Job } from '../jobs/jobs.model.js'
import { sectorFields } from '../meta/sectors.service.js'
import { resolvePlace } from '../places/places.service.js'
import { User } from '../users/users.model.js'
import { AgencyClient } from './agencies.model.js'

/*
 * 2026-11-20: an agency's clients (Agency › Clients). A client is linked to an EU Jobs company when the agency picks
 * one; otherwise same-client rules compare normalised names (clientNameKey).
 */
const SEARCH_RESULTS = 10

// Legal forms dropped from the end of a name, so "Acme Ltd", "ACME" and "Acme, Inc." are one client.
const LEGAL_FORMS = new Set([
  'ltd', 'limited', 'plc', 'llc', 'llp', 'inc', 'incorporated', 'corp', 'corporation', 'co', 'company', 'gmbh', 'ag',
  'kg', 'sa', 'sas', 'sarl', 'sl', 'slu', 'srl', 'spa', 'bv', 'nv', 'oy', 'ab', 'as', 'aps', 'kft', 'sro',
])

/** The name as same-client rules compare it: no accents, case, punctuation or trailing legal form. */
export function clientNameKey(name) {
  const words = name
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    // "S.A." and "Inc." are one word
    .replace(/\./g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .split(' ')
  while (words.length > 1 && LEGAL_FORMS.has(words.at(-1))) words.pop()
  return words.join(' ')
}

const place = (location) => (location?.placeId ? { countryCode: location.countryCode, city: location.city, placeId: location.placeId } : null)

/** Companies of active recruiters (never agencies): the ones a client can be linked to. */
async function linkableCompanyIds() {
  return (await User.find({ role: 'recruiter', status: 'active', companyId: { $ne: null } }, 'companyId')).map((user) => user.companyId)
}

async function clientDtos(clients, viewerId) {
  const [files, linked, counts] = await Promise.all([
    File.find({ _id: { $in: clients.map((client) => client.logoFileId).filter(Boolean) } }),
    Company.find({ _id: { $in: clients.map((client) => client.linkedCompanyId).filter(Boolean) } }, 'displayName'),
    Job.aggregate([{ $match: { 'agency.clientId': { $in: clients.map((client) => client._id) } } }, { $group: { _id: '$agency.clientId', count: { $sum: 1 } } }]),
  ])
  const fileOf = new Map(files.map((file) => [String(file._id), file]))
  const companyOf = new Map(linked.map((company) => [String(company._id), company]))
  const jobsOf = new Map(counts.map((count) => [String(count._id), count.count]))
  return clients.map((client) => {
    const logo = client.logoFileId && fileOf.get(String(client.logoFileId))
    const company = client.linkedCompanyId && companyOf.get(String(client.linkedCompanyId))
    return {
      id: String(client._id),
      name: client.name,
      sector: client.sector ?? null,
      industry: client.industry ?? null,
      location: place(client.location),
      logoUrl: logo ? signedUrl(logo, viewerId) : null,
      linkedCompany: company ? { id: String(company._id), displayName: company.displayName } : null,
      jobs: jobsOf.get(String(client._id)) ?? 0,
      createdAt: client.createdAt,
    }
  })
}

export async function clientDto(client, viewerId) {
  return (await clientDtos([client], viewerId))[0]
}

/** GET /agency/clients: by name. */
export async function listClients(user, company) {
  const clients = await AgencyClient.find({ companyId: company._id }).collation({ locale: 'en' }).sort({ name: 1 })
  const items = await clientDtos(clients, user._id)
  return { items, total: items.length, page: 1, pageSize: items.length }
}

export async function ownClient(company, id) {
  const client = await AgencyClient.findOne({ _id: id, companyId: company._id })
  if (!client) throw new AppError('NOT_FOUND')
  return client
}

/** The stored fields of a client body: the city from Places, a linkable company, a name the agency has not used. */
async function clientFields(user, company, body, existing) {
  const nameKey = clientNameKey(body.name)
  if (await AgencyClient.exists({ companyId: company._id, nameKey, ...(existing && { _id: { $ne: existing._id } }) })) throw fieldError({ name: 'duplicate' })
  if (body.linkedCompanyId && !(await linkableCompanyIds()).some((id) => String(id) === body.linkedCompanyId)) throw fieldError({ linkedCompanyId: 'invalid' })
  let location
  if (body.placeId) location = existing?.location?.placeId === body.placeId ? existing.location : await resolvePlace(body.placeId, user.language)
  return { name: body.name, nameKey, ...(await sectorFields(body.sector, 'sector', existing?.sector)), location, linkedCompanyId: body.linkedCompanyId ?? undefined }
}

export async function createClient(user, company, body) {
  if ((await AgencyClient.countDocuments({ companyId: company._id })) >= LIMITS.agencyClient.max) throw fieldError({ name: 'too_many' }, { max: LIMITS.agencyClient.max })
  return AgencyClient.create({ companyId: company._id, ...(await clientFields(user, company, body)) })
}

export async function updateClient(user, company, id, body) {
  const client = await ownClient(company, id)
  client.set(await clientFields(user, company, body, client))
  await client.save()
  return client
}

/** A client with jobs stays (its jobs and placements name it); one without jobs can be removed. */
export async function deleteClient(company, id) {
  const client = await ownClient(company, id)
  const jobs = await Job.countDocuments({ 'agency.clientId': client._id })
  if (jobs) throw new AppError('CONFLICT', { params: { reason: 'client_has_jobs', jobs } })
  await client.deleteOne()
  await removeFiles([client.logoFileId])
}

/** PNG and JPG re-encoded without metadata; SVG sanitised (as company logos, M-150). */
export async function setClientLogo(user, company, id, upload) {
  const client = await ownClient(company, id)
  const buffer = upload.ext === 'svg' ? sanitizeSvg(upload.buffer) : await reencodeImage(upload.buffer, upload.ext)
  const file = await storeFile({ ownerId: user._id, purpose: 'client_logo', buffer, ext: upload.ext, originalName: upload.originalname })
  const previous = client.logoFileId
  client.logoFileId = file._id
  await client.save()
  await removeFiles([previous])
  return client
}

export async function removeClientLogo(company, id) {
  const client = await ownClient(company, id)
  const previous = client.logoFileId
  client.logoFileId = undefined
  await client.save()
  await removeFiles([previous])
  return client
}

/** GET /agency/clients/companies?q=: verified recruiter companies whose name contains q, to link a client to. */
export async function searchCompanies(user, q) {
  const needle = searchText(q)
  const companies = await Company.find({ _id: { $in: await linkableCompanyIds() }, verifiedAt: { $ne: null }, deletedAt: null }, 'displayName sector industry location logoFileId')
  const found = companies
    .filter((company) => searchText(company.displayName).includes(needle))
    .sort((a, b) => a.displayName.localeCompare(b.displayName))
    .slice(0, SEARCH_RESULTS)
  const logos = await logoUrls(found, user._id)
  return {
    items: found.map((company) => ({
      id: String(company._id),
      displayName: company.displayName,
      sector: company.sector ?? null,
      industry: company.industry ?? null,
      countryCode: company.location?.countryCode ?? null,
      logoUrl: logos.get(String(company._id)) ?? null,
    })),
  }
}
