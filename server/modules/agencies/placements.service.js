import { AppError, fieldError } from '../../lib/errors.js'
import { Company } from '../companies/companies.model.js'
import { logoUrls } from '../companies/companies.service.js'
import { Job } from '../jobs/jobs.model.js'
import { User } from '../users/users.model.js'
import { AgencyClient, AgencyMembership, AgencyPlacement } from './agencies.model.js'
import { currentAgreement } from './agreements.service.js'
import { tellAgency } from './agencies.notify.js'
import { agreedAgreement } from './books.service.js'
import { RULES, rulesDto } from './contracts.js'
import { checkTarget, effectiveEnd, hoursOf, jobTarget, phaseOf, today } from './lock.js'

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

async function placementDtos(placements, viewerId) {
  const [jobs, companies, candidates] = await Promise.all([
    Job.find({ _id: { $in: placements.map((placement) => placement.jobId) } }, 'title agency.rate'),
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
    return {
      id: String(placement._id),
      status: placement.status,
      phase,
      job: { id: String(placement.jobId), title: job?.title ?? null },
      agency: { id: String(placement.companyId), displayName: company?.displayName ?? null, logoUrl: logos.get(String(placement.companyId)) ?? null },
      candidate: { id: String(placement.candidateId), name: nameOf.get(String(placement.candidateId)) ?? null },
      client: placement.client?.name ? { id: String(placement.client.clientId), name: placement.client.name } : null,
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
  const placements = await AgencyPlacement.find({ companyId: company._id, status: { $in: ['offered', 'confirmed'] } }).sort({ startDate: -1, createdAt: -1 })
  const items = await placementDtos(filtered(placements, view), user._id)
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
  return dtoOf(placement, user._id)
}

/**
 * POST /agency/placements/:id/rehire { jobId }: after a placement is over, the agency offers the same person another of
 * its published agency jobs (its dates, rate and contract). The checks run now and again when the candidate accepts.
 */
export async function offerRehire(user, company, id, jobId) {
  const previous = await ownPlacement(company, id)
  if (previous.status !== 'confirmed' || phaseOf(previous) !== 'over') throw new AppError('CONFLICT', { params: { reason: 'not_over' } })
  const job = await Job.findOne({ _id: jobId, companyId: company._id, status: 'published', agency: { $ne: null } })
  if (!job) throw fieldError({ jobId: 'invalid' })
  if (await AgencyPlacement.exists({ candidateId: previous.candidateId, jobId: job._id, status: { $in: ['offered', 'confirmed'] } })) throw new AppError('CONFLICT', { params: { reason: 'already_placed' } })
  await assertOnBooks(company._id, previous.candidateId)
  await assertAllowed(previous.candidateId, job)
  const placement = await AgencyPlacement.create({ ...(await fromJob(job, previous.candidateId)), previousId: previous._id, status: 'offered' })
  return dtoOf(placement, user._id)
}

/** POST /agency/placements/:id/withdraw: an offer the candidate has not answered. */
export async function withdrawOffer(user, company, id) {
  const placement = await ownPlacement(company, id)
  if (placement.status !== 'offered') throw new AppError('CONFLICT', { params: { status: placement.status } })
  placement.status = 'withdrawn'
  placement.decidedAt = new Date()
  await placement.save()
  return dtoOf(placement, user._id)
}

/* ---------- the candidate ---------- */

/** GET /candidate/placements?view=: the candidate's offers and placements. */
export async function myPlacements(user, view) {
  const placements = await AgencyPlacement.find({ candidateId: user._id, status: { $in: ['offered', 'confirmed'] } }).sort({ startDate: -1, createdAt: -1 })
  return { items: await placementDtos(filtered(placements, view), user._id) }
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
