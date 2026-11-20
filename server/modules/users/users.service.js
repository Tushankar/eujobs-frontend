import { isHiring } from '../../config/enums.js'
import bcrypt from 'bcryptjs'
import { fieldError } from '../../lib/errors.js'
import { AdminRole } from '../admin/admin.model.js'
import { Application } from '../applications/applications.model.js'
import { candidateAgencyActions } from '../agencies/books.service.js'
import { candidateCounters } from '../applications/applications.stats.js'
import { CandidateProfile } from '../candidates/candidates.model.js'
import { candidateSummary, fullNameChanged } from '../candidates/candidates.service.js'
import { roleText } from '../admin/admin.access.js'
import { effectivePermissions, listPermissions } from '../admin/admin.service.js'
import { checkPassword, hashPassword } from '../auth/auth.service.js'
import { twoFactorDto } from '../auth/twoFactor.service.js'
import { Company } from '../companies/companies.model.js'
import { logoUrls } from '../companies/companies.service.js'
import { CvVersion } from '../cv/cv.model.js'
import { Job } from '../jobs/jobs.model.js'
import { celebrationDtos } from './celebrations.js'
import { User } from './users.model.js'
import { reissueCertificates } from '../learning/learning.certificates.js'
import { unreadCount } from '../messages/messages.service.js'
import { currentLegalVersions, findEnabledCountry } from '../meta/meta.service.js'
import { counts as notificationCounts, emailSwitches } from '../notifications/notifications.service.js'
import { planState } from '../payments/payments.service.js'

/**
 * The default country (owner 2026-11-19). Accounts from before it get it once: the candidate profile's or the
 * company's location country, else the header country they have now.
 */
async function homeCountryOf(user) {
  if (user.homeCountry || user.role === 'admin') return user.homeCountry ?? null
  const place =
    user.role === 'candidate'
      ? (await CandidateProfile.findOne({ userId: user._id }, 'location').lean())?.location
      : user.companyId && (await Company.findById(user.companyId, 'location').lean())?.location
  const code = place?.countryCode ?? user.pickerCountry
  if (!code) return null
  await User.updateOne({ _id: user._id, homeCountry: { $exists: false } }, { $set: { homeCountry: code } })
  user.homeCountry = code
  return code
}

/**
 * The session profile (GET /me). Candidates carry the completeness checklist and the shell photo URL,
 * plan and entitlements, recruiters their company.
 * `legal.acceptRequired` is true when a newer Terms or Privacy version exists (U22).
 */
export async function meDto(user) {
  const current = await currentLegalVersions()
  const legal = user.legal ?? {}
  const dto = {
    id: String(user._id),
    role: user.role,
    status: user.status,
    email: user.email,
    fullName: user.fullName,
    language: user.language,
    languageExplicit: user.languageExplicit,
    theme: user.theme ?? null,
    pickerCountry: user.pickerCountry ?? null,
    homeCountry: await homeCountryOf(user),
    // Owner 2026-11-16: candidates browse jobs worldwide until they pick Remote or a country.
    ...(user.role === 'candidate' && { jobsWorldwide: user.jobsWorldwide !== false }),
    timezone: user.timezone ?? null,
    emailVerified: Boolean(user.emailVerifiedAt),
    // 2026-11-18: authenticator-app 2FA (Settings › Sign in & security)
    twoFactor: twoFactorDto(user),
    legal: {
      termsVersion: legal.termsVersion ?? null,
      privacyVersion: legal.privacyVersion ?? null,
      acceptedAt: legal.acceptedAt ?? null,
      acceptRequired:
        Boolean(current.termsVersion && current.termsVersion !== legal.termsVersion) ||
        Boolean(current.privacyVersion && current.privacyVersion !== legal.privacyVersion),
    },
  }
  if (user.role === 'candidate' || isHiring(user.role)) {
    dto.tourPending = await tourPending(user)
    // 2026-11-17: success moments waiting for their modal.
    dto.celebrations = celebrationDtos(user)
  }
  if (user.role === 'candidate') {
    dto.onboardingCompleted = Boolean(user.onboardingCompletedAt)
    // From the Stripe subscription (U38): plan key and entitlement keys (§3.3).
    Object.assign(dto, await planState(user._id))
    Object.assign(dto, await candidateSummary(user))
  }
  if (isHiring(user.role)) {
    // §3.22: Free or Recruiter Plus (Agency Plus for agencies, 2026-11-20), with its entitlement keys.
    Object.assign(dto, await planState(user._id))
    dto.jobTitle = user.jobTitle ?? null
    dto.phone = { e164: user.phone?.e164 ?? null, verified: Boolean(user.phone?.verifiedAt) }
    // The shell subtitle and logo (M-195); null until onboarding step 2.
    const company = user.companyId ? await Company.findById(user.companyId, 'displayName logoFileId') : null
    dto.company = company ? { id: String(company._id), displayName: company.displayName, logoUrl: (await logoUrls([company], user._id)).get(String(company._id)) } : null
  }
  if (user.role === 'admin') {
    dto.isOwner = user.isOwner
    dto.permissions = [...(await effectivePermissions(user))]
    // Settings › Your access: every catalogue group (catalogue order) with each of its permissions and whether it is held.
    const groups = new Map()
    for (const { id, group } of await listPermissions()) {
      if (!groups.has(group)) groups.set(group, { group, permissions: [] })
      groups.get(group).permissions.push({ id, held: dto.permissions.includes(id) })
    }
    dto.permissionGroups = [...groups.values()]
    // The shell subtitle shows the role name, or "Owner" for owners (M-195).
    const role = user.adminAccess?.roleId ? await AdminRole.findById(user.adminAccess.roleId, 'name description system') : null
    dto.adminRole = role ? { id: String(role._id), name: roleText(role, user.language).name } : null
  }
  // P11b-Q3, Q12: the email switches of this role's categories.
  dto.emailSwitches = emailSwitches(user)
  return dto
}

/**
 * The first-login product tour opens by itself for an account with no activity yet (no CV and no application; a
 * recruiter's company with no job) until it is finished or skipped. It can always be replayed from the menu.
 */
async function tourPending(user) {
  if (user.tourFinishedAt) return false
  if (isHiring(user.role)) return !user.companyId || !(await Job.exists({ companyId: user.companyId }))
  return !(await CvVersion.exists({ userId: user._id })) && !(await Application.exists({ candidateId: user._id }))
}

/** POST /me/tour: the product tour was finished or skipped. */
export async function finishTour(user) {
  user.tourFinishedAt ??= new Date()
  await user.save()
}

/** GET /me/counters (M-094, P11b-Q2): unread messages (candidates, recruiters), the candidate's active applications, unread notifications. */
export async function counters(user) {
  const notifications = await notificationCounts(user)
  if (user.role === 'admin') return { notifications }
  const unreadMessages = await unreadCount(user, user.companyId)
  if (user.role !== 'candidate') return { unreadMessages, notifications }
  // 2026-11-20: agencyActions = re-hire offers and agreements waiting (the Agencies sidebar badge).
  return { unreadMessages, ...(await candidateCounters(user)), agencyActions: await candidateAgencyActions(user), notifications }
}

/** PATCH /me. Until the language is explicit, the country's default language follows the country (M-134). */
export async function updateMe(user, patch) {
  const nameChanged = patch.fullName !== undefined && patch.fullName !== user.fullName
  if (patch.fullName !== undefined) user.fullName = patch.fullName
  if (patch.timezone !== undefined) user.timezone = patch.timezone
  if (patch.languageExplicit !== undefined) user.languageExplicit = patch.languageExplicit
  if (patch.language !== undefined) user.language = patch.language
  if (patch.theme !== undefined) user.theme = patch.theme
  if (patch.pickerCountry !== undefined) {
    // Admins have no country picker (M-138).
    if (user.role === 'admin') throw fieldError({ pickerCountry: 'not_allowed' })
    const country = await findEnabledCountry(patch.pickerCountry, 'pickerCountry')
    user.pickerCountry = country.code
    if (!user.languageExplicit && patch.language === undefined) user.language = country.defaultLanguage
  }
  // Server side only (onboarding, company location; mePatchBody drops it), always with the same pickerCountry.
  if (patch.homeCountry !== undefined) user.homeCountry = user.pickerCountry
  if (patch.jobsWorldwide !== undefined) {
    if (user.role !== 'candidate') throw fieldError({ jobsWorldwide: 'not_allowed' })
    user.jobsWorldwide = patch.jobsWorldwide
  }
  await user.save()
  if (nameChanged && user.role === 'candidate') await fullNameChanged(user._id)
  // U17: certificates are re-issued with the new name under the same code.
  if (nameChanged) await reissueCertificates(user)
}

/** M-010: current + new password; other sessions stay signed in. */
export async function changePassword(user, { currentPassword, newPassword }) {
  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) throw fieldError({ currentPassword: 'invalid' })
  checkPassword(newPassword, user.email, 'newPassword')
  user.passwordHash = await hashPassword(newPassword)
  await user.save()
}

/** M-191, U22: records the current Terms and Privacy versions. */
export async function acceptLegal(user) {
  user.legal = { ...(await currentLegalVersions()), acceptedAt: new Date() }
  await user.save()
}
