import { config } from '../../config/env.js'
import { interpolate, t } from '../../lib/i18n.js'
import { sendEmail } from '../../lib/mailer.js'
import { companyRecruiter, notify } from '../notifications/notifications.service.js'

/*
 * 2026-11-20 (phase 4): the agency hears about its books and placements: a notification in the bell and an
 * "agency update" email (its own switch in Settings › Notifications). Each type opens one page.
 */
const PAGE = {
  agency_join_requested: { id: 'talentRequests', path: 'talent?tab=requests' },
  agency_member_agreed: { id: 'talent', path: 'talent' },
  agency_member_left: { id: 'talent', path: 'talent' },
  placement_offer_answered: { id: 'placements', path: 'placements?tab=upcoming' },
  placement_notice_given: { id: 'placements', path: 'placements' },
}

/** Tells the agency of `companyId` about `type`; `params` name the candidate (and job, version, date, decision). */
export async function tellAgency(companyId, type, params) {
  const agency = await companyRecruiter(companyId)
  if (!agency) return
  const page = PAGE[type]
  await notify(agency, type, { params, target: { kind: 'page', id: page.id } })
  const key = `email.agencySummary.${type}${params.decision ? `.${params.decision}` : ''}`
  // An email that fails must not undo what the candidate did.
  try {
    await sendEmail({
      type: 'agency_update',
      to: agency.email,
      userId: agency._id,
      language: agency.language,
      params: { name: agency.fullName, summary: interpolate(t(agency.language, key), params), link: `${config.clientOrigin}/agency/${page.path}` },
    })
  } catch (error) {
    console.error(`Agency update email failed: ${error.message}`)
  }
}
