import { config } from '../../config/env.js'
import { interpolate, t } from '../../lib/i18n.js'
import { sendEmail } from '../../lib/mailer.js'
import { User } from '../users/users.model.js'
import { companyRecruiter, notify } from '../notifications/notifications.service.js'

/*
 * 2026-11-20 (phase 4): the agency hears about its books and placements: a notification in the bell and an
 * "agency update" email (its own switch in Settings › Notifications). Each type opens one page.
 * Phase 5: the candidate hears about theirs the same way (the candidate's Agencies page, same email switch).
 */
const PAGE = {
  agency_join_requested: { id: 'talentRequests', path: 'talent?tab=requests' },
  agency_member_agreed: { id: 'talent', path: 'talent' },
  agency_member_left: { id: 'talent', path: 'talent' },
  placement_offer_answered: { id: 'placements', path: 'placements?tab=upcoming' },
  placement_notice_given: { id: 'placements', path: 'placements' },
  placement_ending_soon: { id: 'placements', path: 'placements' },
}

const CANDIDATE_PAGE = {
  agency_invited: { id: 'myAgencies', path: 'agencies?tab=agencies' },
  agency_request_accepted: { id: 'myAgencies', path: 'agencies?tab=agencies' },
  agency_membership_declined: { id: 'myAgencies', path: 'agencies?tab=agencies' },
  agency_removed: { id: 'myAgencies', path: 'agencies?tab=agencies' },
  agency_agreement_updated: { id: 'myAgencies', path: 'agencies?tab=agencies' },
  placement_confirmed: { id: 'agencyPlacements', path: 'agencies' },
  placement_ended_early: { id: 'agencyPlacements', path: 'agencies' },
  placement_offered: { id: 'agencyOffers', path: 'agencies?tab=offers' },
  placement_offer_withdrawn: { id: 'agencyOffers', path: 'agencies?tab=offers' },
  placement_starts_soon: { id: 'agencyPlacements', path: 'agencies' },
  placement_ends_soon: { id: 'agencyPlacements', path: 'agencies' },
}

// A "YYYY-MM-DD" day as the reader writes it (the bell formats it in the browser).
const longDay = (language, day) => new Intl.DateTimeFormat(language, { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${day}T00:00:00Z`))

/** Bell + email for `user`; `key` is the email summary's text key. An email that fails must not undo what was done. */
async function tell(user, type, params, page, key, link) {
  await notify(user, type, { params, target: { kind: 'page', id: page.id } })
  const values = {
    ...params,
    ...(params.date && { date: longDay(user.language, params.date) }),
    // Phase 6: a list of job titles reads as one phrase ("A, B and C").
    ...(Array.isArray(params.jobs) && { jobs: new Intl.ListFormat(user.language, { type: 'conjunction' }).format(params.jobs) }),
  }
  try {
    await sendEmail({
      type: 'agency_update',
      to: user.email,
      userId: user._id,
      language: user.language,
      params: { name: user.fullName, summary: interpolate(t(user.language, key), values), link },
    })
  } catch (error) {
    console.error(`Agency update email failed: ${error.message}`)
  }
}

/** Tells the agency of `companyId` about `type`; `params` name the candidate (and job, version, date, decision). */
export async function tellAgency(companyId, type, params) {
  const agency = await companyRecruiter(companyId)
  if (!agency) return
  const page = PAGE[type]
  const variant = params.decision ?? params.variant
  await tell(agency, type, params, page, `email.agencySummary.${type}${variant ? `.${variant}` : ''}`, `${config.clientOrigin}/agency/${page.path}`)
}

/** Tells the candidate `candidateId` about `type`; `params` name the agency (and job, version, date, decision). */
export async function tellCandidate(candidateId, type, params) {
  const candidate = await User.findOne({ _id: candidateId, role: 'candidate', status: 'active' })
  if (!candidate) return
  const page = CANDIDATE_PAGE[type]
  await tell(candidate, type, params, page, `email.candidateSummary.${type}${params.decision ? `.${params.decision}` : ''}`, `${config.clientOrigin}/candidate/${page.path}`)
}
