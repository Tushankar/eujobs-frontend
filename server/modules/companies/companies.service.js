import { config } from '../../config/env.js'
import { actorFor, recordAudit } from '../../lib/audit.js'
import { AppError, fieldError } from '../../lib/errors.js'
import { removeFiles, signedUrl, storeFile } from '../../lib/files.js'
import { interpolate, t } from '../../lib/i18n.js'
import { reencodeImage, sanitizedUpload } from '../../lib/images.js'
import { sanitizeSvg } from '../../lib/svg.js'
import { normalizePhone } from '../auth/auth.service.js'
import { File } from '../files/files.model.js'
import { reissueCertificates } from '../learning/learning.certificates.js'
import { notifyAdmins } from '../notifications/notifications.service.js'
import { resolvePlace } from '../places/places.service.js'
import { updateMe } from '../users/users.service.js'
import { Company, KycDocument } from './companies.model.js'

/*
 * Recruiter onboarding (§3.12, M-145 … M-153) and the Company page (M-147, M-150). Step 1 is filled at sign-up
 * and always counts done; the other steps are derived from the stored data (P4-D1, P4-D2).
 */
const REQUIRED_DOCUMENTS = ['identity', 'registration']
// M-185, M-152: onboarding data and KYC files change only while onboarding or after a rejection.
const EDITABLE = ['onboarding', 'rejected']

const place = (location) => (location?.placeId ? { countryCode: location.countryCode, city: location.city, placeId: location.placeId } : null)

/** The company's logo URLs for one viewer (U39), by company id. */
export async function logoUrls(companies, viewerId) {
  const files = await File.find({ _id: { $in: companies.map((company) => company.logoFileId).filter(Boolean) } })
  const byId = new Map(files.map((file) => [String(file._id), file]))
  return new Map(companies.map((company) => [String(company._id), company.logoFileId && byId.has(String(company.logoFileId)) ? signedUrl(byId.get(String(company.logoFileId)), viewerId) : null]))
}

/** The same, from company ids alone (lists that kept only the name). */
export async function logoUrlsById(ids, viewerId) {
  return logoUrls(await Company.find({ _id: { $in: ids } }, 'logoFileId'), viewerId)
}

/** What candidates and job pages show of a company (M-042, A: recruiter A30). */
export function publicCompanyDto(company, logoUrl) {
  return {
    id: String(company._id),
    displayName: company.displayName,
    industry: company.industry ?? null,
    size: company.size ?? null,
    description: company.description ?? '',
    website: company.website ?? null,
    logoUrl: logoUrl ?? null,
  }
}

/** The recruiter's own company record. */
export async function companyDto(company, viewerId) {
  const logoUrl = (await logoUrls([company], viewerId)).get(String(company._id))
  return {
    ...publicCompanyDto(company, logoUrl),
    legalName: company.legalName,
    businessEmail: company.businessEmail ?? '',
    location: place(company.location),
    businessAddress: company.businessAddress ?? '',
    registrationDetails: company.registrationDetails ?? '',
    verifiedAt: company.verifiedAt ?? null,
    submittedAt: company.submittedAt ?? null,
  }
}

/* ---------- onboarding ---------- */

const companyOf = (user) => (user.companyId ? Company.findById(user.companyId) : null)

/** P4-D2: which steps are done, from the stored data. */
function stepsOf(user, company, documents) {
  const types = new Set(documents.map((document) => document.type))
  return {
    account: true,
    company: Boolean(company),
    kyc: REQUIRED_DOCUMENTS.every((type) => types.has(type)),
    verify: Boolean(user.phone?.verifiedAt),
  }
}

/** M-151: the first open step, or `review` once everything is in. */
const nextStep = (steps) => ['company', 'kyc', 'verify'].find((step) => !steps[step]) ?? 'review'

export async function currentStep(user) {
  const company = await companyOf(user)
  const documents = company ? await KycDocument.find({ companyId: company._id }, 'type') : []
  return nextStep(stepsOf(user, company, documents))
}

/** GET /recruiter/onboarding: every step's data and state, and the latest decision. */
export async function onboardingDto(user) {
  const company = await companyOf(user)
  const documents = company ? await KycDocument.find({ companyId: company._id }).sort({ uploadedAt: 1 }) : []
  const files = new Map((await File.find({ _id: { $in: documents.map((document) => document.fileId) } })).map((file) => [String(file._id), file]))
  const steps = stepsOf(user, company, documents)
  const decision = company?.reviewHistory.at(-1)
  return {
    status: user.status,
    editable: EDITABLE.includes(user.status),
    steps,
    currentStep: nextStep(steps),
    account: {
      fullName: user.fullName,
      jobTitle: user.jobTitle ?? '',
      email: user.email,
      emailVerified: Boolean(user.emailVerifiedAt),
      phone: { e164: user.phone?.e164 ?? null, verified: Boolean(user.phone?.verifiedAt) },
    },
    company: company ? await companyDto(company, user._id) : null,
    documents: documents.map((document) => {
      const file = files.get(String(document.fileId))
      return {
        id: String(document._id),
        type: document.type,
        name: file?.originalName ?? null,
        size: file?.size ?? null,
        mime: file?.mime ?? null,
        uploadedAt: document.uploadedAt,
        url: file ? signedUrl(file, user._id) : null,
      }
    }),
    submittedAt: company?.submittedAt ?? null,
    decision: decision ? { decision: decision.decision, reason: decision.reason ?? null, at: decision.at } : null,
  }
}

export function assertEditable(user) {
  if (!EDITABLE.includes(user.status)) throw new AppError('LOCKED', { params: { status: user.status } })
}

/** Step 1 (P4-D1): a changed phone number is unverified until its code is confirmed (M-004). */
export async function updateAccount(user, { fullName, jobTitle, phone, country }) {
  assertEditable(user)
  const e164 = normalizePhone(phone, country ?? user.pickerCountry)
  const nameChanged = fullName !== user.fullName
  user.fullName = fullName
  user.jobTitle = jobTitle
  if (user.phone?.e164 !== e164) user.phone = { e164 }
  await user.save()
  // U17: certificates are re-issued with the new name under the same code.
  if (nameChanged) await reissueCertificates(user)
}

/**
 * Step 2 (M-146, M-149): creates or updates the company. Until approval the display name is the legal name.
 * A new company country becomes the header country, and the language follows unless chosen (M-134).
 */
export async function saveOnboardingCompany(user, body) {
  assertEditable(user)
  const existing = await companyOf(user)
  const location = existing?.location?.placeId === body.placeId ? existing.location : await resolvePlace(body.placeId, user.language)
  const fields = { ...body, placeId: undefined, displayName: body.legalName, location, registrationDetails: body.registrationDetails || undefined }
  const company = existing ?? new Company({ ownerUserId: user._id })
  company.set(fields)
  await company.save()
  if (!user.companyId) {
    user.companyId = company._id
    await user.save()
  }
  if (existing?.location?.countryCode !== location.countryCode) await updateMe(user, { pickerCountry: location.countryCode })
}

async function ownCompany(user) {
  const company = await companyOf(user)
  if (!company) throw fieldError({ company: 'required' })
  return company
}

/** Step 3 (M-185): one file per type; a new upload replaces the earlier file of that type. */
export async function uploadDocument(user, type, upload) {
  assertEditable(user)
  const company = await ownCompany(user)
  const buffer = await sanitizedUpload(upload)
  const file = await storeFile({ ownerId: user._id, purpose: 'kyc', buffer, ext: upload.ext, originalName: upload.originalname })
  const previous = await KycDocument.findOneAndDelete({ companyId: company._id, type })
  await KycDocument.create({ companyId: company._id, userId: user._id, type, fileId: file._id })
  if (previous) await removeFiles([previous.fileId])
}

export async function deleteDocument(user, id) {
  assertEditable(user)
  const document = await KycDocument.findOneAndDelete({ _id: id, userId: user._id })
  if (!document) throw new AppError('NOT_FOUND')
  await removeFiles([document.fileId])
}

/** Step 4, then submit (M-003, M-152): every step done; the account waits for an admin. */
export async function submit(user) {
  assertEditable(user)
  const step = await currentStep(user)
  if (step !== 'review') throw fieldError({ [step]: 'required' }, { step })
  const company = await companyOf(user)
  const resubmitted = user.status === 'rejected'
  company.submittedAt = new Date()
  await company.save()
  user.status = 'pending_review'
  await user.save()
  await recordAudit({
    type: resubmitted ? 'moderation.account_resubmitted' : 'moderation.account_submitted',
    category: 'moderation',
    actor: actorFor(user),
    target: { type: 'user', id: user._id },
    params: { name: user.fullName, company: company.legalName },
  })
  // P11b-Q1: account reviewers are told at once; a resubmission says so.
  await notifyAdmins('admin_account_review', {
    params: { name: user.fullName, company: company.legalName, resubmitted },
    target: { kind: 'account', id: user._id },
    emailParams: (language) => ({
      summary: interpolate(t(language, `email.adminSummary.${resubmitted ? 'accountResubmitted' : 'accountSubmitted'}`), { recruiter: user.fullName, company: company.legalName }),
      link: `${config.clientOrigin}/admin/moderation/accounts/${user._id}`,
    }),
  })
}

/* ---------- the Company page (approved recruiters) ---------- */

/** M-147: display name, industry, size, city, website and description; the legal name stays as verified. */
export async function updateCompany(user, company, body) {
  const location = company.location?.placeId === body.placeId ? company.location : await resolvePlace(body.placeId, user.language)
  company.set({ ...body, placeId: undefined, location })
  await company.save()
}

/** M-150: PNG and JPG re-encoded without metadata; SVG sanitised. */
export async function setLogo(user, company, upload) {
  const buffer = upload.ext === 'svg' ? sanitizeSvg(upload.buffer) : await reencodeImage(upload.buffer, upload.ext)
  const file = await storeFile({ ownerId: user._id, purpose: 'company_logo', buffer, ext: upload.ext, originalName: upload.originalname })
  const previous = company.logoFileId
  company.logoFileId = file._id
  await company.save()
  await removeFiles([previous])
}

export async function removeLogo(company) {
  const previous = company.logoFileId
  company.logoFileId = undefined
  await company.save()
  await removeFiles([previous])
}
