import { AppError } from '../../lib/errors.js'
import { signedUrl } from '../../lib/files.js'
import { hasEntitlement, planRequired } from '../../middleware/entitlements.js'
import { Application } from '../applications/applications.model.js'
import { CandidateProfile } from '../candidates/candidates.model.js'
import { Company } from '../companies/companies.model.js'
import { logoUrls } from '../companies/companies.service.js'
import { accessibleCandidate } from '../discovery/discovery.service.js'
import { File } from '../files/files.model.js'
import { User } from '../users/users.model.js'
import { AgencyAgreement, AgencyMembership, AgencyPlacement } from './agencies.model.js'
import { tellAgency, tellCandidate } from './agencies.notify.js'
import { currentAgreement } from './agreements.service.js'
import { rulesDto } from './contracts.js'

/*
 * 2026-11-20: candidates on an agency's books. A candidate asks to join, or the agency invites (its own applicants on any
 * plan, any discoverable candidate with Agency Plus, as for starting a conversation). Taking anyone on needs a published
 * agreement; the candidate is on the books once they agree to the current version. Either side can end it at any time;
 * declined and ended memberships can start again. A candidate can be on several agencies' books.
 */
const OPEN = ['requested', 'awaiting_agreement', 'active']

const lastAcceptance = (membership) => membership.acceptances.at(-1) ?? null

function move(membership, status, by) {
  membership.status = status
  membership.history.push({ status, by, at: new Date() })
  if (status === 'ended') membership.endedBy = by
}

/** The agency's company, when its owner is an approved agency. */
async function agencyCompany(companyId) {
  const company = await Company.findById(companyId)
  if (!company || !(await User.exists({ _id: company.ownerUserId, role: 'agency', status: 'active' }))) throw new AppError('NOT_FOUND')
  return company
}

async function requireAgreement(company) {
  const agreement = await currentAgreement(company._id)
  if (!agreement) throw new AppError('CONFLICT', { params: { reason: 'no_agreement' } })
  return agreement
}

/** Starts (or starts again) a membership in `status`; an open one is a CONFLICT naming its status. */
async function open(companyId, candidateId, status, by) {
  const membership = (await AgencyMembership.findOne({ companyId, candidateId })) ?? new AgencyMembership({ companyId, candidateId })
  if (OPEN.includes(membership.status)) throw new AppError('CONFLICT', { params: { status: membership.status } })
  membership.requestedBy = by
  membership.endedBy = undefined
  move(membership, status, by)
  await membership.save()
  return membership
}

/** The version the candidate agreed to last, and whether a newer version waits for them. */
function agreementState(membership, current) {
  const accepted = lastAcceptance(membership)
  return {
    acceptedVersion: accepted?.version ?? null,
    acceptedAt: accepted?.at ?? null,
    needsAgreement: Boolean(current) && ['awaiting_agreement', 'active'].includes(membership.status) && accepted?.version !== current.version,
  }
}

/* ---------- the agency's side ---------- */

async function talentDtos(memberships, current) {
  const ids = memberships.map((membership) => membership.candidateId)
  const [users, profiles] = await Promise.all([User.find({ _id: { $in: ids } }, 'fullName'), CandidateProfile.find({ userId: { $in: ids } }, 'userId headline location')])
  const userOf = new Map(users.map((user) => [String(user._id), user]))
  const profileOf = new Map(profiles.map((profile) => [String(profile.userId), profile]))
  return memberships.map((membership) => {
    const profile = profileOf.get(String(membership.candidateId))
    return {
      id: String(membership._id),
      status: membership.status,
      requestedBy: membership.requestedBy,
      candidate: {
        id: String(membership.candidateId),
        name: userOf.get(String(membership.candidateId))?.fullName ?? null,
        headline: profile?.headline ?? null,
        location: profile?.location?.placeId ? { countryCode: profile.location.countryCode, city: profile.location.city } : null,
      },
      ...agreementState(membership, current),
      endedBy: membership.endedBy ?? null,
      updatedAt: membership.updatedAt,
    }
  })
}

/** GET /agency/talent?status=: the agency's memberships (newest change first) and counts by status. */
export async function listTalent(company, status) {
  const [memberships, current, counts] = await Promise.all([
    AgencyMembership.find({ companyId: company._id, ...(status && { status }) }).sort({ updatedAt: -1 }),
    currentAgreement(company._id),
    AgencyMembership.aggregate([{ $match: { companyId: company._id } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
  ])
  const items = await talentDtos(memberships, current)
  return { items, total: items.length, page: 1, pageSize: items.length, counts: Object.fromEntries(counts.map((count) => [count._id, count.count])) }
}

async function ownMembership(company, id) {
  const membership = await AgencyMembership.findOne({ _id: id, companyId: company._id })
  if (!membership) throw new AppError('NOT_FOUND')
  return membership
}

const agencyAnswer = async (company, membership) => (await talentDtos([membership], await currentAgreement(company._id)))[0]

/** POST /agency/talent/invite: an applicant (not withdrawn) on any plan, anyone else listable with Agency Plus. */
export async function invite(user, company, candidateId) {
  await requireAgreement(company)
  const applied = await Application.exists({ companyId: company._id, candidateId, status: { $ne: 'withdrawn' } })
  if (!applied && !(await hasEntitlement(user, 'outreach'))) throw planRequired('outreach')
  await accessibleCandidate(candidateId, company, { status: { $ne: 'withdrawn' } })
  const existing = await AgencyMembership.findOne({ companyId: company._id, candidateId })
  // A candidate who already asked is accepted instead.
  if (existing?.status === 'requested') return accept(company, existing._id)
  const membership = await open(company._id, candidateId, 'awaiting_agreement', 'agency')
  await tellCandidate(candidateId, 'agency_invited', { agency: company.displayName })
  return agencyAnswer(company, membership)
}

/** POST /agency/talent/:id/accept: a request is accepted; the candidate then agrees to the agreement. */
export async function accept(company, id) {
  await requireAgreement(company)
  const membership = await ownMembership(company, id)
  if (membership.status !== 'requested') throw new AppError('CONFLICT', { params: { status: membership.status } })
  move(membership, 'awaiting_agreement', 'agency')
  await membership.save()
  await tellCandidate(membership.candidateId, 'agency_request_accepted', { agency: company.displayName })
  return agencyAnswer(company, membership)
}

/** POST /agency/talent/:id/decline: a request or an unanswered invitation. */
export async function declineByAgency(company, id) {
  const membership = await ownMembership(company, id)
  if (!['requested', 'awaiting_agreement'].includes(membership.status)) throw new AppError('CONFLICT', { params: { status: membership.status } })
  // A request turned down, or an invitation (or accepted request) the agency takes back.
  const decision = membership.status === 'requested' ? 'request' : 'invitation'
  move(membership, 'declined', 'agency')
  await membership.save()
  await tellCandidate(membership.candidateId, 'agency_membership_declined', { agency: company.displayName, decision })
  return agencyAnswer(company, membership)
}

/** POST /agency/talent/:id/end: the candidate leaves the books (a running placement continues to its end). */
export async function endByAgency(company, id) {
  const membership = await ownMembership(company, id)
  if (membership.status !== 'active') throw new AppError('CONFLICT', { params: { status: membership.status } })
  move(membership, 'ended', 'agency')
  await membership.save()
  await tellCandidate(membership.candidateId, 'agency_removed', { agency: company.displayName })
  return agencyAnswer(company, membership)
}

/* ---------- the candidate's side ---------- */

async function candidateDtos(user, memberships) {
  const companies = await Company.find({ _id: { $in: memberships.map((membership) => membership.companyId) } }, 'displayName logoFileId industry')
  const companyOf = new Map(companies.map((company) => [String(company._id), company]))
  const logos = await logoUrls(companies, user._id)
  const currents = new Map(await Promise.all(companies.map(async (company) => [String(company._id), await currentAgreement(company._id)])))
  return memberships.map((membership) => {
    const company = companyOf.get(String(membership.companyId))
    const current = currents.get(String(membership.companyId))
    return {
      id: String(membership._id),
      status: membership.status,
      requestedBy: membership.requestedBy,
      agency: { id: String(company._id), displayName: company.displayName, industry: company.industry ?? null, logoUrl: logos.get(String(company._id)) ?? null },
      agreement: current ? { version: current.version, publishedAt: current.publishedAt } : null,
      ...agreementState(membership, current),
      endedBy: membership.endedBy ?? null,
      updatedAt: membership.updatedAt,
    }
  })
}

/** GET /candidate/agencies: every agency the candidate asked to join, was invited by or is on the books of. */
export async function myAgencies(user) {
  const memberships = await AgencyMembership.find({ candidateId: user._id }).sort({ updatedAt: -1 })
  return { items: await candidateDtos(user, memberships) }
}

async function myMembership(user, id) {
  const membership = await AgencyMembership.findOne({ _id: id, candidateId: user._id })
  if (!membership) throw new AppError('NOT_FOUND')
  return membership
}

const candidateAnswer = async (user, membership) => (await candidateDtos(user, [membership]))[0]

/** POST /candidate/agencies/:companyId/join: a request the agency answers. */
export async function join(user, companyId) {
  const company = await agencyCompany(companyId)
  const membership = await open(company._id, user._id, 'requested', 'candidate')
  await tellAgency(company._id, 'agency_join_requested', { candidate: user.fullName })
  return candidateAnswer(user, membership)
}

/** GET /candidate/agencies/memberships/:id/agreement: the current agreement to read before agreeing (PDF and rules). */
export async function agreementForCandidate(user, id) {
  const membership = await myMembership(user, id)
  const current = await currentAgreement(membership.companyId)
  if (!current) throw new AppError('NOT_FOUND')
  const file = await File.findById(current.file.fileId)
  return { version: current.version, publishedAt: current.publishedAt, file: { name: current.file.name, url: file ? signedUrl(file, user._id) : null }, rules: rulesDto(current.rules) }
}

/**
 * POST /candidate/agencies/memberships/:id/agree { version }: "I agree" to the current version (the version read must
 * still be current), recorded with the candidate's name and the date. Also how a candidate on the books agrees to a new one.
 */
export async function agree(user, id, version) {
  const membership = await myMembership(user, id)
  if (!['awaiting_agreement', 'active'].includes(membership.status)) throw new AppError('CONFLICT', { params: { status: membership.status } })
  const current = await currentAgreement(membership.companyId)
  if (!current || current.version !== version) throw new AppError('CONFLICT', { params: { reason: 'agreement_changed', version: current?.version ?? null } })
  if (lastAcceptance(membership)?.version === version) throw new AppError('CONFLICT', { params: { reason: 'already_agreed' } })
  membership.acceptances.push({ version, name: user.fullName, at: new Date() })
  if (membership.status !== 'active') move(membership, 'active', 'candidate')
  await membership.save()
  await tellAgency(membership.companyId, 'agency_member_agreed', { candidate: user.fullName, version })
  return candidateAnswer(user, membership)
}

/** POST …/decline: withdraws a request or turns down an invitation. */
export async function declineByCandidate(user, id) {
  const membership = await myMembership(user, id)
  if (!['requested', 'awaiting_agreement'].includes(membership.status)) throw new AppError('CONFLICT', { params: { status: membership.status } })
  move(membership, 'declined', 'candidate')
  await membership.save()
  return candidateAnswer(user, membership)
}

/** POST …/end: leaves the books (a running placement continues to its end). */
export async function endByCandidate(user, id) {
  const membership = await myMembership(user, id)
  if (membership.status !== 'active') throw new AppError('CONFLICT', { params: { status: membership.status } })
  move(membership, 'ended', 'candidate')
  await membership.save()
  await tellAgency(membership.companyId, 'agency_member_left', { candidate: user.fullName })
  return candidateAnswer(user, membership)
}

/** The agreement version whose rules apply to this candidate with this agency (the last one agreed to), or null (phase 3). */
export async function agreedAgreement(companyId, candidateId) {
  const membership = await AgencyMembership.findOne({ companyId, candidateId }, 'acceptances')
  const version = membership && lastAcceptance(membership)?.version
  return version ? AgencyAgreement.findOne({ companyId, version }) : null
}

/** GET /me/counters (phase 5): what waits for the candidate on Agencies: open re-hire offers and agreements to agree to. */
export async function candidateAgencyActions(user) {
  const [offers, memberships] = await Promise.all([
    AgencyPlacement.countDocuments({ candidateId: user._id, status: 'offered' }),
    AgencyMembership.find({ candidateId: user._id, status: { $in: ['awaiting_agreement', 'active'] } }, 'companyId status acceptances'),
  ])
  const waiting = await Promise.all(memberships.map(async (membership) => agreementState(membership, await currentAgreement(membership.companyId)).needsAgreement))
  return offers + waiting.filter(Boolean).length
}
