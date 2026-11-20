import { LIMITS } from '../../config/limits.js'
import { Company } from '../companies/companies.model.js'
import { AgencyClient, AgencyPlacement } from './agencies.model.js'
import { clientNameKey } from './agencies.service.js'

/*
 * 2026-11-20: may the candidate take this job, given their agency placements? For every confirmed placement that is
 * running, upcoming or still in its cooling-off time:
 *   1. its rules (fixed at confirmation: contract, else agreement, else default);
 *   2. its effective end: the end date, brought forward by the agency's earlier end or the candidate's notice
 *      (notice day + the notice period);
 *   3. overlap: the job starts on or before that end and ends on or after the placement starts (a company job has no
 *      dates: it runs from today, open-ended);
 *   4. exclusivity while they overlap: no other work blocks any job; no other agency work blocks other agencies' jobs
 *      (the default blocks every agency job); no same client blocks jobs at the placement's client; free allows;
 *   5. a maximum of weekly hours blocks a job that, with every overlapping placement, goes over it;
 *   6. cooling-off: a job at the placement's client, through anyone but this agency, starting within the cooling-off
 *      days after the end.
 * Each block names the rule, its clause and where it came from, and the day the candidate is free of it.
 */
const DAY_MS = 24 * 60 * 60 * 1000
const DEFAULT_HOURS = LIMITS.job.agency.defaultHours

export const today = () => new Date().toISOString().slice(0, 10)
export const addDays = (day, days) => new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10)
const latest = (days) => days.reduce((a, b) => (b > a ? b : a))
const earliest = (days) => days.reduce((a, b) => (b < a ? b : a))

/** The day a placement really ends: its end date, or earlier by the agency's end or the candidate's notice. */
export function effectiveEnd(placement) {
  const days = [placement.endDate]
  if (placement.endedEarlyOn) days.push(placement.endedEarlyOn)
  if (placement.noticeGivenOn) days.push(addDays(placement.noticeGivenOn, placement.rules?.noticeDays?.value ?? 0))
  return earliest(days)
}

/** upcoming, running or over (by today's date). */
export function phaseOf(placement, day = today()) {
  if (day < placement.startDate) return 'upcoming'
  return day <= effectiveEnd(placement) ? 'running' : 'over'
}

export const hoursOf = (job) => job.agency?.hoursPerWeek ?? DEFAULT_HOURS[job.employmentType] ?? DEFAULT_HOURS.full_time

/** The client of a placement or a job, as same-client rules compare it: EU Jobs company ids and normalised names. */
const sameClient = (a, b) => a.companyIds.some((id) => b.companyIds.includes(id)) || a.nameKeys.some((key) => b.nameKeys.includes(key))
const placementClient = (placement) => ({
  companyIds: placement.client?.linkedCompanyId ? [String(placement.client.linkedCompanyId)] : [],
  nameKeys: placement.client?.nameKey ? [placement.client.nameKey] : [],
})

/**
 * What taking `job` would mean: who offers it (the agency, or null for a company job), its dates, its hours and its
 * client (an agency job's client; a company job's company).
 */
export async function jobTarget(job) {
  if (job.agency) {
    const client = job.agency.clientId && (await AgencyClient.findById(job.agency.clientId, 'nameKey linkedCompanyId'))
    return {
      jobId: String(job._id),
      agencyCompanyId: String(job.companyId),
      start: job.agency.startDate ?? today(),
      end: job.agency.endDate ?? null,
      hours: hoursOf(job),
      client: { companyIds: client?.linkedCompanyId ? [String(client.linkedCompanyId)] : [], nameKeys: client ? [client.nameKey] : [] },
    }
  }
  const company = await Company.findById(job.companyId, 'displayName legalName')
  return {
    jobId: String(job._id),
    agencyCompanyId: null,
    start: today(),
    end: null,
    hours: hoursOf(job),
    client: { companyIds: [String(job.companyId)], nameKeys: [...new Set([company?.displayName, company?.legalName].filter(Boolean).map(clientNameKey))] },
  }
}

const overlaps = (target, placement) => target.start <= effectiveEnd(placement) && (target.end === null || target.end >= placement.startDate)

/** The blocks one placement puts on the target (none, one or two). */
function blocksOf(placement, target, overlapping) {
  const end = effectiveEnd(placement)
  const block = (rule, freeFrom) => ({
    placementId: String(placement._id),
    agencyCompanyId: String(placement.companyId),
    rule,
    value: placement.rules[rule].value,
    clause: placement.rules[rule].clause ?? null,
    source: placement.sources?.[rule] ?? null,
    freeFrom,
  })
  const blocks = []
  const ownAgency = target.agencyCompanyId === String(placement.companyId)
  const client = sameClient(target.client, placementClient(placement))
  if (overlaps(target, placement)) {
    const exclusivity = placement.rules.exclusivity?.value
    const byDefault = placement.sources?.exclusivity === 'default'
    const excluded =
      exclusivity === 'no_other_work' ||
      (exclusivity === 'no_other_agency_work' && target.agencyCompanyId && (byDefault || !ownAgency)) ||
      (exclusivity === 'no_same_client' && client && !ownAgency)
    if (excluded) blocks.push(block('exclusivity', addDays(end, 1)))
    const max = placement.rules.maxWeeklyHours?.value
    if (!excluded && max && target.hours + overlapping.reduce((sum, other) => sum + other.hoursPerWeek, 0) > max) blocks.push(block('maxWeeklyHours', addDays(end, 1)))
  }
  const cooling = placement.rules.coolingOffDays?.value
  if (cooling && client && !ownAgency && target.start > end && target.start <= addDays(end, cooling)) blocks.push(block('coolingOffDays', addDays(end, cooling + 1)))
  return blocks
}

/**
 * The candidate's blocks for `target` (jobTarget), from their confirmed placements other than `exceptId`;
 * `freeFrom` is the first day all of them have lifted (null when nothing blocks).
 */
export async function checkTarget(candidateId, target, { exceptId = null } = {}) {
  const placements = (await AgencyPlacement.find({ candidateId, status: 'confirmed', ...(exceptId && { _id: { $ne: exceptId } }) })).filter(
    (placement) => addDays(effectiveEnd(placement), placement.rules?.coolingOffDays?.value ?? 0) >= target.start,
  )
  const overlapping = placements.filter((placement) => overlaps(target, placement))
  const blocks = placements.flatMap((placement) => blocksOf(placement, target, overlapping))
  return { allowed: blocks.length === 0, blocks, freeFrom: blocks.length ? latest(blocks.map((entry) => entry.freeFrom)) : null }
}
