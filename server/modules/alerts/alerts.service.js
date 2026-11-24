import { LIMITS } from '../../config/limits.js'
import { AppError, fieldError } from '../../lib/errors.js'
import { planState } from '../payments/payments.service.js'
import { viewOf } from '../jobs/jobs.search.js'
import { checkSectors } from '../meta/sectors.service.js'
import { resolvePlace } from '../places/places.service.js'
import { AlertMatch, JobAlert } from './alerts.model.js'

/*
 * Job alert CRUD (§3.6, M-031, M-119, P7-Q2). Every candidate can read and delete their alerts; creating and
 * changing them needs `job_alerts` (the route). Without the plan the alerts are kept but paused (`planPaused`).
 */
const A = LIMITS.jobAlert

const place = (location) => (location?.placeId ? { countryCode: location.countryCode, city: location.city, placeId: location.placeId } : null)

const alertDto = (alert) => ({
  id: String(alert._id),
  name: alert.name,
  keywords: alert.keywords,
  sectors: alert.sectors ?? [],
  location: place(alert.location),
  country: alert.country,
  frequency: alert.frequency,
  active: alert.active,
  createdAt: alert.createdAt,
})

async function ownAlert(user, id) {
  const alert = await JobAlert.findOne({ _id: id, candidateId: user._id })
  if (!alert) throw new AppError('NOT_FOUND')
  return alert
}

/** G-1: an optional city inside the alert's country (any city for Worldwide); a Remote alert has none. An unchanged city keeps its name. */
async function alertLocation(user, placeId, country, existing) {
  if (!placeId) return null
  if (placeId === existing?.placeId) return existing
  if (country === 'REMOTE') throw fieldError({ placeId: 'invalid' })
  const location = await resolvePlace(placeId, user.language)
  if (country !== 'WORLDWIDE' && location.countryCode !== country) throw fieldError({ placeId: 'other_country' }, { country })
  return location
}

export async function listAlerts(user) {
  const alerts = await JobAlert.find({ candidateId: user._id }).sort({ createdAt: -1 })
  const { entitlements } = await planState(user._id)
  return { items: alerts.map(alertDto), total: alerts.length, page: 1, pageSize: alerts.length, planPaused: !entitlements.includes('job_alerts') }
}

/** 2026-11-24: an alert needs keywords or at least one sector. */
function assertCriteria(keywords, sectors) {
  if (!keywords && !sectors.length) throw fieldError({ keywords: 'required' })
}

/** U35: the alert keeps the candidate's view (Worldwide, Remote or a country) and the language it was created in. */
export async function createAlert(user, { name, keywords, sectors, placeId, frequency }) {
  if ((await JobAlert.countDocuments({ candidateId: user._id })) >= A.max) throw fieldError({ alerts: 'too_many' }, { max: A.max })
  assertCriteria(keywords, sectors)
  const country = viewOf(user)
  const location = await alertLocation(user, placeId, country)
  return alertDto(await JobAlert.create({ candidateId: user._id, name, keywords, sectors: await checkSectors(sectors, 'sectors'), location, country, language: user.language, frequency }))
}

export async function updateAlert(user, id, patch) {
  const alert = await ownAlert(user, id)
  if (patch.sectors !== undefined) alert.sectors = await checkSectors(patch.sectors, 'sectors', alert.sectors)
  for (const field of ['name', 'keywords', 'frequency', 'active']) if (patch[field] !== undefined) alert[field] = patch[field]
  assertCriteria(alert.keywords, alert.sectors)
  if (patch.placeId !== undefined) alert.location = await alertLocation(user, patch.placeId, alert.country, place(alert.location))
  await alert.save()
  return alertDto(alert)
}

export async function deleteAlert(user, id) {
  const alert = await ownAlert(user, id)
  await Promise.all([alert.deleteOne(), AlertMatch.deleteMany({ alertId: alert._id })])
}
