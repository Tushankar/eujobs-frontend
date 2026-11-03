import bcrypt from 'bcryptjs'
import { fieldError } from '../../lib/errors.js'
import { AdminRole } from '../admin/admin.model.js'
import { candidateCounters } from '../applications/applications.stats.js'
import { candidateSummary, fullNameChanged } from '../candidates/candidates.service.js'
import { effectivePermissions } from '../admin/admin.service.js'
import { checkPassword, hashPassword } from '../auth/auth.service.js'
import { Company } from '../companies/companies.model.js'
import { logoUrls } from '../companies/companies.service.js'
import { unreadCount } from '../messages/messages.service.js'
import { currentLegalVersions, findEnabledCountry } from '../meta/meta.service.js'
import { planState } from '../payments/payments.service.js'

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
    pickerCountry: user.pickerCountry ?? null,
    timezone: user.timezone ?? null,
    emailVerified: Boolean(user.emailVerifiedAt),
    legal: {
      termsVersion: legal.termsVersion ?? null,
      privacyVersion: legal.privacyVersion ?? null,
      acceptedAt: legal.acceptedAt ?? null,
      acceptRequired:
        Boolean(current.termsVersion && current.termsVersion !== legal.termsVersion) ||
        Boolean(current.privacyVersion && current.privacyVersion !== legal.privacyVersion),
    },
  }
  if (user.role === 'candidate') {
    dto.onboardingCompleted = Boolean(user.onboardingCompletedAt)
    // From the Stripe subscription (U38): plan key and entitlement keys (§3.3).
    Object.assign(dto, await planState(user._id))
    Object.assign(dto, await candidateSummary(user))
  }
  if (user.role === 'recruiter') {
    dto.jobTitle = user.jobTitle ?? null
    dto.phone = { e164: user.phone?.e164 ?? null, verified: Boolean(user.phone?.verifiedAt) }
    // The shell subtitle and logo (M-195); null until onboarding step 2.
    const company = user.companyId ? await Company.findById(user.companyId, 'displayName logoFileId') : null
    dto.company = company ? { id: String(company._id), displayName: company.displayName, logoUrl: (await logoUrls([company], user._id)).get(String(company._id)) } : null
  }
  if (user.role === 'admin') {
    dto.isOwner = user.isOwner
    dto.permissions = [...(await effectivePermissions(user))]
    // The shell subtitle shows the role name, or "Owner" for owners (M-195).
    const role = user.adminAccess?.roleId ? await AdminRole.findById(user.adminAccess.roleId, 'name') : null
    dto.adminRole = role ? { id: String(role._id), name: role.name } : null
  } else {
    dto.notifyEmail = user.notifyEmail
  }
  return dto
}

/** GET /me/counters (M-094): unread messages for both roles; recruiters have no application badge. */
export async function counters(user) {
  const unreadMessages = await unreadCount(user, user.companyId)
  return user.role === 'candidate' ? { unreadMessages, ...(await candidateCounters(user)) } : { unreadMessages }
}

/** PATCH /me. Until the language is explicit, the country's default language follows the country (M-134). */
export async function updateMe(user, patch) {
  const nameChanged = patch.fullName !== undefined && patch.fullName !== user.fullName
  if (patch.fullName !== undefined) user.fullName = patch.fullName
  if (patch.timezone !== undefined) user.timezone = patch.timezone
  if (patch.languageExplicit !== undefined) user.languageExplicit = patch.languageExplicit
  if (patch.language !== undefined) user.language = patch.language
  if (patch.pickerCountry !== undefined) {
    // Admins have no country picker (M-138).
    if (user.role === 'admin') throw fieldError({ pickerCountry: 'not_allowed' })
    const country = await findEnabledCountry(patch.pickerCountry, 'pickerCountry')
    user.pickerCountry = country.code
    if (!user.languageExplicit && patch.language === undefined) user.language = country.defaultLanguage
  }
  await user.save()
  if (nameChanged && user.role === 'candidate') await fullNameChanged(user._id)
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
