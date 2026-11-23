import { AppError, fieldError } from '../../lib/errors.js'
import { dailyJobs } from '../../jobs/scheduler.js'
import { Company } from '../companies/companies.model.js'
import { logoUrls } from '../companies/companies.service.js'
import { Job } from '../jobs/jobs.model.js'
import { skillOverlap } from '../../lib/skills.js'
import { CandidateProfile } from '../candidates/candidates.model.js'
import { agencyClients } from '../jobs/jobs.search.js'
import { resultsBy } from '../matching/matching.service.js'
import { User } from '../users/users.model.js'
import { AgencyClient, AgencyMembership, AgencyPlacement } from './agencies.model.js'
import { currentAgreement } from './agreements.service.js'
import { tellAgency, tellCandidate } from './agencies.notify.js'
import { agreedAgreement } from './books.service.js'
import { RULES, rulesDto } from './contracts.js'
import { addDays, checkTarget, checkWith, effectiveEnd, hoursOf, jobTarget, phaseOf, targetOf, today } from './lock.js'

/*
 * 2026-11-20: placements. Hired on an agency job creates a confirmed placement; a re-hire is offered and confirmed when
 * the candidate accepts. Both need the candidate on the agency's books with the current agreement agreed, and pass the
 * rule check (lock.js). Leaving Hired cancels a placement that has not started; a started one is ended by the agency
 * (an earlier end date) or by the candidate's notice.
 */

/** PLACEMENT_LOCKED with the blocks (rule, clause, source, free-from day), when the check does not allow the job. */
export async function assertAllowed(candidateId, job, options) {
  const result = await checkTarget(candidateId, await jobTarget(job), options)
  if (!result.allowed) throw new AppError('PLACEMENT_LOCKED', { params: { blocks: result.blocks, freeFrom: result.freeFrom } })
}

/** The candidate is on the agency's books and agreed to its current agreement (CONFLICT names what is missing). */
async function assertOnBooks(companyId, candidateId) {
  const [membership, current] = await Promise.all([AgencyMembership.findOne({ companyId, candidateId }, 'status acceptances'), currentAgreement(companyId)])
  if (membership?.status !== 'active') throw new AppError('CONFLICT', { params: { reason: 'not_on_books' } })
  if (!current || membership.acceptances.at(-1)?.version !== current.version) throw new AppError('CONFLICT', { params: { reason: 'agreement_pending' } })
}

/** Each rule from the job's confirmed contract, else the agreement version agreed to, else the default exclusivity. */
async function placementRules(job, candidateId) {
  const contract = job.agency.contract?.confirmedAt ? job.agency.contract.rules : null
  const agreement = await agreedAgreement(job.companyId, candidateId)
  const rules = {}
  const sources = {}
  for (const name of RULES) {
    const from = [
      ['contract', contract?.[name]],
      ['agreement', agreement?.rules?.[name]],
    ].find(([, rule]) => rule?.value != null)
    if (from) {
      rules[name] = { value: from[1].value, clause: from[1].clause ?? undefined }
      sources[name] = from[0]
    } else if (name === 'exclusivity') {
      // The default: no other agency job while this one runs.
      rules[name] = { value: 'no_other_agency_work' }
      sources[name] = 'default'
    } else rules[name] = { value: null }
  }
  return { rules, sources, agreementVersion: agreement?.version }
}

/** A placement's fields from its job. */
async function fromJob(job, candidateId) {
  const client = await AgencyClient.findById(job.agency.clientId)
  return {
    companyId: job.companyId,
    candidateId,
    jobId: job._id,
    client: client ? { clientId: client._id, name: client.name, nameKey: client.nameKey, linkedCompanyId: client.linkedCompanyId } : undefined,
    startDate: job.agency.startDate,
    endDate: job.agency.endDate,
    hoursPerWeek: hoursOf(job),
  }
}

/* ---------- the pipeline (applications.service.js) ---------- */

/** Moving an application to Hired on an agency job: the checks, then a confirmed placement. */
export async function hire(application, job) {
  if (!job.agency) return
  await assertOnBooks(job.companyId, application.candidateId)
  await assertAllowed(application.candidateId, job)
  const now = new Date()
  await AgencyPlacement.create({
    ...(await fromJob(job, application.candidateId)),
    ...(await placementRules(job, application.candidateId)),
    applicationId: application._id,
    status: 'confirmed',
    confirmedAt: now,
    decidedAt: now,
  })
  const agency = await Company.findById(job.companyId, 'displayName')
  await tellCandidate(application.candidateId, 'placement_confirmed', { agency: agency?.displayName ?? '', job: job.title, date: job.agency.startDate })
}

/** Leaving Hired: a placement that has not started is cancelled; a started one keeps the stage (CONFLICT). */
export async function unhire(application) {
  const placement = await AgencyPlacement.findOne({ applicationId: application._id, status: 'confirmed' })
  if (!placement) return
  if (today() >= placement.startDate) throw new AppError('CONFLICT', { params: { reason: 'placement_started' } })
  placement.status = 'cancelled'
  placement.decidedAt = new Date()
  await placement.save()
}

/* ---------- DTOs ---------- */

async function placementDtos(placements, viewerId, { candidate = false } = {}) {
  const [jobs, companies, candidates] = await Promise.all([
    Job.find({ _id: { $in: placements.map((placement) => placement.jobId) } }, 'title agency.rate agency.showClient'),
    Company.find({ _id: { $in: placements.map((placement) => placement.companyId) } }, 'displayName logoFileId'),
    User.find({ _id: { $in: placements.map((placement) => placement.candidateId) } }, 'fullName'),
  ])
  const jobOf = new Map(jobs.map((job) => [String(job._id), job]))
  const companyOf = new Map(companies.map((company) => [String(company._id), company]))
  const nameOf = new Map(candidates.map((user) => [String(user._id), user.fullName]))
  const logos = await logoUrls(companies, viewerId)
  return placements.map((placement) => {
    const job = jobOf.get(String(placement.jobId))
    const company = companyOf.get(String(placement.companyId))
    const confirmed = placement.status === 'confirmed'
    const phase = confirmed ? phaseOf(placement) : null
    // 2026-11-20 (phase 5): a candidate's open offer keeps a confidential client hidden until they accept.
    const hideClient = candidate && placement.status === 'offered' && job?.agency?.showClient === false
    return {
      id: String(placement._id),
      status: placement.status,
      phase,
      job: { id: String(placement.jobId), title: job?.title ?? null },
      agency: { id: String(placement.companyId), displayName: company?.displayName ?? null, logoUrl: logos.get(String(placement.companyId)) ?? null },
      candidate: { id: String(placement.candidateId), name: nameOf.get(String(placement.candidateId)) ?? null },
      client: placement.client?.name && !hideClient ? { id: String(placement.client.clientId), name: placement.client.name } : null,
      startDate: placement.startDate,
      endDate: placement.endDate,
      effectiveEnd: confirmed ? effectiveEnd(placement) : null,
      hoursPerWeek: placement.hoursPerWeek,
      rate: job?.agency?.rate?.amountMinor ? { amountMinor: job.agency.rate.amountMinor, currency: job.agency.rate.currency, period: job.agency.rate.period } : null,
      rules: placement.rules ? rulesDto(placement.rules) : null,
      sources: placement.sources ? Object.fromEntries(RULES.map((name) => [name, placement.sources[name] ?? null])) : null,
      noticeGivenOn: placement.noticeGivenOn ?? null,
      endedEarlyOn: placement.endedEarlyOn ?? null,
      previousId: placement.previousId ? String(placement.previousId) : null,
      createdAt: placement.createdAt,
    }
  })
}

const dtoOf = async (placement, viewerId) => (await placementDtos([placement], viewerId))[0]

// A list's filter: offers (open offers), upcoming, running or over (confirmed, by date).
function filtered(placements, view) {
  if (!view) return placements
  if (view === 'offered') return placements.filter((placement) => placement.status === 'offered')
  return placements.filter((placement) => placement.status === 'confirmed' && phaseOf(placement) === view)
}

/* ---------- the agency ---------- */

/** GET /agency/placements?view=: newest start first. */
export async function agencyPlacements(user, company, view) {
  const placements = filtered(await AgencyPlacement.find({ companyId: company._id, status: { $in: ['offered', 'confirmed'] } }).sort({ startDate: -1, createdAt: -1 }), view)
  const items = await placementDtos(placements, user._id)
  // Phase 6: a running placement that ends within the agency's alert window shows what fits that person next.
  const alertDay = addDays(today(), AGENCY_ENDS_SOON_DAYS)
  for (const [index, placement] of placements.entries()) {
    if (placement.status === 'confirmed' && phaseOf(placement) === 'running' && effectiveEnd(placement) <= alertDay) items[index].next = await nextFitsOf(placement)
  }
  return { items, total: items.length, page: 1, pageSize: items.length }
}

async function ownPlacement(company, id) {
  const placement = await AgencyPlacement.findOne({ _id: id, companyId: company._id })
  if (!placement) throw new AppError('NOT_FOUND')
  return placement
}

/** POST /agency/placements/:id/end { endDate }: a running or upcoming placement ends earlier (today at the soonest). */
export async function endEarly(user, company, id, endDate) {
  const placement = await ownPlacement(company, id)
  if (placement.status !== 'confirmed' || phaseOf(placement) === 'over') throw new AppError('CONFLICT', { params: { status: placement.status } })
  if (endDate < today() || endDate < placement.startDate || endDate >= effectiveEnd(placement)) throw fieldError({ endDate: 'invalid' })
  placement.endedEarlyOn = endDate
  await placement.save()
  const job = await Job.findById(placement.jobId, 'title')
  await tellCandidate(placement.candidateId, 'placement_ended_early', { agency: company.displayName, job: job?.title ?? '', date: effectiveEnd(placement) })
  return dtoOf(placement, user._id)
}

/** An offer of `job` (published, the agency's own) to a candidate on the books; the checks run now and again on accept. */
async function offer(user, company, job, candidateId, previousId) {
  if (await AgencyPlacement.exists({ candidateId, jobId: job._id, status: { $in: ['offered', 'confirmed'] } })) throw new AppError('CONFLICT', { params: { reason: 'already_placed' } })
  await assertOnBooks(company._id, candidateId)
  await assertAllowed(candidateId, job)
  const placement = await AgencyPlacement.create({ ...(await fromJob(job, candidateId)), ...(previousId && { previousId }), status: 'offered' })
  await tellCandidate(candidateId, 'placement_offered', { agency: company.displayName, job: job.title })
  return dtoOf(placement, user._id)
}

async function publishedAgencyJob(company, jobId) {
  const job = await Job.findOne({ _id: jobId, companyId: company._id, status: 'published', agency: { $ne: null } })
  if (!job) throw fieldError({ jobId: 'invalid' })
  return job
}

/**
 * POST /agency/placements/:id/rehire { jobId }: after a placement is over, the agency offers the same person another of
 * its published agency jobs (its dates, rate and contract).
 */
export async function offerRehire(user, company, id, jobId) {
  const previous = await ownPlacement(company, id)
  if (previous.status !== 'confirmed' || phaseOf(previous) !== 'over') throw new AppError('CONFLICT', { params: { reason: 'not_over' } })
  return offer(user, company, await publishedAgencyJob(company, jobId), previous.candidateId, previous._id)
}

/** POST /agency/placements/offer { jobId, candidateId } (phase 6): an offer straight to someone on the books. */
export async function offerPlacement(user, company, { jobId, candidateId }) {
  return offer(user, company, await publishedAgencyJob(company, jobId), candidateId)
}

/*
 * Phase 6: what fits a person next. The agency's own published agency jobs starting on or after `freeFrom`, that the
 * person may take (rule check) and was not offered yet, best match first (the stored score, else required-skill overlap).
 */
const NEXT_FITS = 3

async function nextFits(companyId, candidateId, freeFrom, confirmed) {
  const [jobs, taken, profile] = await Promise.all([
    Job.find({ companyId, status: 'published', 'agency.startDate': { $gte: freeFrom } }),
    AgencyPlacement.find({ candidateId, status: { $in: ['offered', 'confirmed'] } }, 'jobId'),
    CandidateProfile.findOne({ userId: candidateId }, 'skills'),
  ])
  const takenIds = new Set(taken.map((placement) => String(placement.jobId)))
  const open = jobs.filter((job) => !takenIds.has(String(job._id)))
  if (!open.length) return []
  const [clients, results] = await Promise.all([agencyClients(open), resultsBy({ candidateId }, open.map((job) => job._id))])
  const overlap = (job) => skillOverlap(profile?.skills ?? [], job).matched.length
  return open
    .filter((job) => checkWith(confirmed, targetOf(job, clients.get(String(job.agency.clientId)))).allowed)
    .map((job) => ({ job, result: results.get(String(job._id)) ?? null }))
    .sort((a, b) => (b.result?.score ?? -1) - (a.result?.score ?? -1) || overlap(b.job) - overlap(a.job) || a.job.agency.startDate.localeCompare(b.job.agency.startDate))
    .slice(0, NEXT_FITS)
    .map(({ job, result }) => ({
      id: String(job._id),
      title: job.title,
      startDate: job.agency.startDate,
      endDate: job.agency.endDate,
      match: result ? { score: result.score, label: result.label ?? null } : null,
    }))
}

/** The next fits of a confirmed placement: jobs from the day after it really ends. */
async function nextFitsOf(placement) {
  const confirmed = await AgencyPlacement.find({ candidateId: placement.candidateId, status: 'confirmed' })
  return nextFits(placement.companyId, placement.candidateId, addDays(effectiveEnd(placement), 1), confirmed)
}

/** POST /agency/placements/:id/withdraw: an offer the candidate has not answered. */
export async function withdrawOffer(user, company, id) {
  const placement = await ownPlacement(company, id)
  if (placement.status !== 'offered') throw new AppError('CONFLICT', { params: { status: placement.status } })
  placement.status = 'withdrawn'
  placement.decidedAt = new Date()
  await placement.save()
  const job = await Job.findById(placement.jobId, 'title')
  await tellCandidate(placement.candidateId, 'placement_offer_withdrawn', { agency: company.displayName, job: job?.title ?? '' })
  return dtoOf(placement, user._id)
}

/* ---------- the candidate ---------- */

/** GET /candidate/placements?view=: the candidate's offers and placements. */
export async function myPlacements(user, view) {
  const placements = filtered(await AgencyPlacement.find({ candidateId: user._id, status: { $in: ['offered', 'confirmed'] } }).sort({ startDate: -1, createdAt: -1 }), view)
  // An offer shows the rules that would apply if accepted now (phase 5: read before accepting); nothing is saved.
  for (const placement of placements.filter((entry) => entry.status === 'offered')) {
    const job = await Job.findById(placement.jobId)
    if (job) placement.set(await placementRules(job, user._id))
  }
  return { items: await placementDtos(placements, user._id, { candidate: true }) }
}

async function myPlacement(user, id) {
  const placement = await AgencyPlacement.findOne({ _id: id, candidateId: user._id })
  if (!placement) throw new AppError('NOT_FOUND')
  return placement
}

/** POST /candidate/placements/:id/accept: a re-hire offer, if the books, the agreement and the rule check allow it. */
export async function acceptOffer(user, id) {
  const placement = await myPlacement(user, id)
  if (placement.status !== 'offered') throw new AppError('CONFLICT', { params: { status: placement.status } })
  const job = await Job.findById(placement.jobId)
  if (!job || job.status !== 'published') throw new AppError('JOB_NOT_ACCEPTING')
  await assertOnBooks(placement.companyId, user._id)
  await assertAllowed(user._id, job)
  // The job's terms as they are now.
  const now = new Date()
  placement.set({ ...(await fromJob(job, user._id)), ...(await placementRules(job, user._id)), status: 'confirmed', confirmedAt: now, decidedAt: now })
  await placement.save()
  await tellAgency(placement.companyId, 'placement_offer_answered', { candidate: user.fullName, job: job.title, decision: 'accepted' })
  return dtoOf(placement, user._id)
}

export async function declineOffer(user, id) {
  const placement = await myPlacement(user, id)
  if (placement.status !== 'offered') throw new AppError('CONFLICT', { params: { status: placement.status } })
  placement.status = 'declined'
  placement.decidedAt = new Date()
  await placement.save()
  const job = await Job.findById(placement.jobId, 'title')
  await tellAgency(placement.companyId, 'placement_offer_answered', { candidate: user.fullName, job: job?.title ?? '', decision: 'declined' })
  return dtoOf(placement, user._id)
}

/** POST /candidate/placements/:id/notice: once, from today; the placement ends after the notice period. */
export async function giveNotice(user, id) {
  const placement = await myPlacement(user, id)
  if (placement.status !== 'confirmed' || phaseOf(placement) === 'over') throw new AppError('CONFLICT', { params: { status: placement.status } })
  if (placement.noticeGivenOn) throw new AppError('CONFLICT', { params: { reason: 'notice_given' } })
  placement.noticeGivenOn = today()
  await placement.save()
  const job = await Job.findById(placement.jobId, 'title')
  await tellAgency(placement.companyId, 'placement_notice_given', { candidate: user.fullName, job: job?.title ?? '', date: effectiveEnd(placement) })
  return dtoOf(placement, user._id)
}

/** GET /candidate/placements/check?jobId=: whether the candidate may take a job now, and what blocks it. */
export async function checkJob(user, jobId) {
  const job = await Job.findOne({ _id: jobId, status: { $ne: 'draft' } })
  if (!job) throw new AppError('NOT_FOUND')
  return checkTarget(user._id, await jobTarget(job))
}

/*
 * Daily (phase 5): a placement starting tomorrow, and one ending in 3 days (its effective end, so a notice or an
 * earlier end is reminded too). Each day is reminded once; a new end date is reminded again.
 */
const ENDS_SOON_DAYS = 3
// Phase 6: the agency hears 7 days before the effective end, with the jobs that fit the person next.
const AGENCY_ENDS_SOON_DAYS = 7

/** The agency's ending-soon alert for one placement whose effective end is `endsOn`. */
async function alertAgency(placement, endsOn) {
  // Marked first, so a failing notice is not sent twice.
  await AgencyPlacement.updateOne({ _id: placement._id }, { remindedAgencyEndOn: endsOn })
  const [job, candidate, next] = await Promise.all([Job.findById(placement.jobId, 'title'), User.findById(placement.candidateId, 'fullName'), nextFitsOf(placement)])
  await tellAgency(placement.companyId, 'placement_ending_soon', {
    candidate: candidate?.fullName ?? null,
    job: job?.title ?? '',
    date: endsOn,
    next: next.length,
    jobs: next.map((entry) => entry.title),
    variant: next.length ? 'fits' : 'none',
  })
}

export async function sendPlacementReminders() {
  const tomorrow = addDays(today(), 1)
  const endsOn = addDays(today(), ENDS_SOON_DAYS)
  const agencyEndsOn = addDays(today(), AGENCY_ENDS_SOON_DAYS)
  const placements = await AgencyPlacement.find({ status: 'confirmed', $or: [{ startDate: tomorrow, remindedStartOn: null }, { endDate: { $gte: endsOn }, startDate: { $lte: agencyEndsOn } }] })
  for (const placement of placements) {
    if (effectiveEnd(placement) === agencyEndsOn && placement.remindedAgencyEndOn !== agencyEndsOn) await alertAgency(placement, agencyEndsOn)
    const due = [
      placement.startDate === tomorrow && !placement.remindedStartOn && { type: 'placement_starts_soon', date: tomorrow, mark: { remindedStartOn: tomorrow } },
      effectiveEnd(placement) === endsOn && placement.remindedEndOn !== endsOn && { type: 'placement_ends_soon', date: endsOn, mark: { remindedEndOn: endsOn } },
    ].filter(Boolean)
    if (!due.length) continue
    const [job, agency] = await Promise.all([Job.findById(placement.jobId, 'title'), Company.findById(placement.companyId, 'displayName')])
    for (const reminder of due) {
      // Marked first, so a failing notice is not sent twice.
      await AgencyPlacement.updateOne({ _id: placement._id }, reminder.mark)
      await tellCandidate(placement.candidateId, reminder.type, { agency: agency?.displayName ?? '', job: job?.title ?? '', date: reminder.date })
    }
  }
}

dailyJobs.push({ name: 'placement-reminders', hour: 8, run: sendPlacementReminders })
