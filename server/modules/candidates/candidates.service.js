import { LIMITS } from '../../config/limits.js'
import { AppError, fieldError } from '../../lib/errors.js'
import { removeFiles, signedUrl, storeFile } from '../../lib/files.js'
import { sanitizedUpload, squareWebp } from '../../lib/images.js'
import { CvVersion } from '../cv/cv.model.js'
import { File } from '../files/files.model.js'
import { Country } from '../meta/meta.model.js'
import { resolvePlace } from '../places/places.service.js'
import { User } from '../users/users.model.js'
import { VerificationSubmission } from '../verification/verification.model.js'
import { computeCompleteness } from './candidates.completeness.js'
import { CandidateProfile } from './candidates.model.js'

const P = LIMITS.profile

/* ---------- loading, completeness and resets ---------- */

/** The candidate's profile, created empty on first use (a partial draft is allowed, M-014). */
export function loadProfile(userId) {
  return CandidateProfile.findOneAndUpdate({ userId }, { $setOnInsert: { userId } }, { upsert: true, returnDocument: 'after' })
}

async function completenessOf(user, profile) {
  const approved = await VerificationSubmission.distinct('category', { userId: user._id, status: 'approved', resetAt: null })
  return computeCompleteness({ user, profile, approved: new Set(approved) })
}

/** Saves the profile with its stored completeness (§3.2: recomputed on every change). */
export async function saveProfile(user, profile) {
  const { complete, done, total, items } = await completenessOf(user, profile)
  profile.completeness = { complete, done, total, missing: items.filter((item) => !item.done).map((item) => item.key) }
  await profile.save()
}

/** Recomputes after a change outside the profile: phone, live CV, a verification decision or reset. */
export async function refreshCompleteness(userId) {
  const [user, profile] = await Promise.all([User.findById(userId), loadProfile(userId)])
  await saveProfile(user, profile)
}

/**
 * U27: approvals linked to an edited entry stop counting. A deleted entry also withdraws evidence still in
 * review, which would otherwise be reviewed against nothing.
 */
export function resetSubmissions(userId, filter, { withdraw = false } = {}) {
  const status = withdraw ? { $in: ['approved', 'in_review'] } : 'approved'
  return VerificationSubmission.updateMany({ userId, ...filter, status, resetAt: null }, { resetAt: new Date() })
}

/** M-012, U27: the identity check is linked to the account name, so a new name resets it. */
export async function fullNameChanged(userId) {
  await resetSubmissions(userId, { category: 'identity' })
  await refreshCompleteness(userId)
}

/* ---------- DTOs ---------- */

const signedFor = (file, userId, options) => (file ? signedUrl(file, userId, options) : null)
const today = () => new Date().toISOString().slice(0, 10)

/** GET /candidate/profile: every section, the checklist, and signed URLs for the owner's own files. */
export async function profileDto(user, profile) {
  const fileIds = [profile.photo?.fileId, ...profile.certificates.map((certificate) => certificate.fileId)].filter(Boolean)
  const files = new Map((await File.find({ _id: { $in: fileIds } })).map((file) => [String(file._id), file]))
  const fileOf = (id) => (id ? files.get(String(id)) : undefined)
  const liveCv = profile.liveCvVersionId ? await CvVersion.findById(profile.liveCvVersionId, 'number originalName') : null
  const { location, salaryMin, links } = profile
  return {
    fullName: user.fullName,
    headline: profile.headline ?? '',
    location: location?.placeId ? { countryCode: location.countryCode, city: location.city, placeId: location.placeId } : null,
    about: profile.about ?? '',
    yearsExperience: profile.yearsExperience ?? null,
    skills: profile.skills.map((skill) => skill.name),
    workPreference: profile.workPreference ?? null,
    availability: profile.availability,
    salaryMin: salaryMin?.amount ? { amount: salaryMin.amount, currency: salaryMin.currency, period: salaryMin.period } : null,
    workHistory: profile.workHistory.map((entry) => ({
      id: String(entry._id),
      title: entry.title,
      employer: entry.employer,
      start: entry.start,
      end: entry.end ?? null,
      current: Boolean(entry.current),
      description: entry.description ?? '',
    })),
    noWorkExperience: profile.noWorkExperience,
    education: profile.education.map((entry) => ({
      id: String(entry._id),
      institution: entry.institution,
      degree: entry.degree,
      start: entry.start,
      end: entry.end ?? null,
      stillStudying: Boolean(entry.stillStudying),
    })),
    noFormalQualification: profile.noFormalQualification,
    languages: profile.languages.map(({ code, level }) => ({ code, level })),
    // U27: an expired permit shows "Permit expired"; completeness is unaffected.
    rightToWork: profile.rightToWork.map((entry) => ({
      id: String(entry._id),
      region: entry.region,
      status: entry.status,
      permitExpiresOn: entry.permitExpiresOn ?? null,
      permitExpired: Boolean(entry.permitExpiresOn && entry.permitExpiresOn < today()),
    })),
    links: { linkedin: links?.linkedin ?? '', portfolio: links?.portfolio ?? '' },
    photoUrl: signedFor(fileOf(profile.photo?.fileId), user._id),
    certificates: profile.certificates.map((certificate) => {
      const file = fileOf(certificate.fileId)
      return {
        id: String(certificate._id),
        name: certificate.name,
        issuer: certificate.issuer,
        issuedOn: certificate.issuedOn,
        expiresOn: certificate.expiresOn ?? null,
        url: certificate.url ?? '',
        file: file ? { name: file.originalName, url: signedUrl(file, user._id) } : null,
      }
    }),
    liveCv: liveCv ? { id: String(liveCv._id), number: liveCv.number, originalName: liveCv.originalName } : null,
    completeness: await completenessOf(user, profile),
  }
}

/** What /me carries for a candidate: the checklist and the shell photo (M-195). */
export async function candidateSummary(user) {
  const profile = await loadProfile(user._id)
  const photo = profile.photo?.smallFileId ? await File.findById(profile.photo.smallFileId) : null
  return { completeness: await completenessOf(user, profile), photoUrl: signedFor(photo, user._id) }
}

/* ---------- core fields ---------- */

/** A city field sends a placeId; an unchanged city keeps the name in the language it was picked in (§2.16). */
function placeFor(profile, placeId, language) {
  return placeId === profile.location?.placeId ? profile.location : resolvePlace(placeId, language)
}

/** M-131, P3-D6: the salary must be in the currency of the profile city's country. */
async function checkSalary(salaryMin, location) {
  if (!salaryMin) return null
  const country = await Country.findOne({ code: location.countryCode }, 'currency')
  if (salaryMin.currency !== country?.currency) throw fieldError({ 'salaryMin.currency': 'not_allowed' })
  return salaryMin
}

/** M-064: unique case-insensitively. */
function checkSkills(names) {
  const keys = names.map((name) => name.toLocaleLowerCase())
  const duplicate = names.find((name, index) => keys.indexOf(keys[index]) !== index)
  if (duplicate) throw fieldError({ skills: 'duplicate' }, { skill: duplicate })
  return names.map((name, index) => ({ name, key: keys[index] }))
}

/** PUT /candidate/profile: the Edit profile dialog (P3-D9). */
export async function updateProfile(user, profile, body) {
  const location = await placeFor(profile, body.placeId, user.language)
  const fields = {
    headline: body.headline,
    location,
    about: body.about,
    yearsExperience: body.yearsExperience,
    skills: checkSkills(body.skills),
    workPreference: body.workPreference,
    availability: body.availability,
    salaryMin: await checkSalary(body.salaryMin, location),
  }
  if (body.fullName !== user.fullName) {
    user.fullName = body.fullName
    await user.save()
    await resetSubmissions(user._id, { category: 'identity' })
  }
  profile.set(fields)
  await saveProfile(user, profile)
}

/** M-014: the onboarding preferences step (P3-D2). */
export async function savePreferences(user, profile, body) {
  const location = await placeFor(profile, body.placeId, user.language)
  profile.set({ workPreference: body.workPreference, location, salaryMin: await checkSalary(body.salaryMin, location) })
  await saveProfile(user, profile)
}

/** M-014: the plan step ends onboarding. Returns the profile country, which the header country takes (M-136). */
export async function completeOnboarding(user, profile) {
  if (!profile.location?.placeId || !profile.workPreference) throw fieldError({ preferences: 'required' })
  user.onboardingCompletedAt ??= new Date()
  await user.save()
  return profile.location.countryCode
}

/* ---------- work history and education ---------- */

const ENTRY_KINDS = {
  'work-history': { field: 'workHistory', category: 'employment', ongoing: 'current', none: 'noWorkExperience', max: P.workHistory.max },
  education: { field: 'education', category: 'academic', ongoing: 'stillStudying', none: 'noFormalQualification', max: P.education.max },
}
export const ENTRY_KIND_PATHS = Object.keys(ENTRY_KINDS)

/** M-018, M-019: an end month not before the start, or "current"/"still studying" with no end. */
function entryFields(body, ongoing) {
  if (body[ongoing]) return { ...body, end: undefined }
  if (!body.end) throw fieldError({ end: 'required' })
  if (body.end < body.start) throw fieldError({ end: 'before_start' })
  return body
}

// An unset flag equals false and an empty text equals none, so re-saving the same entry changes nothing.
const normal = (value) => (value === '' || value === undefined || value === false ? null : value)
const changed = (entry, fields) => Object.entries(fields).some(([key, value]) => normal(entry[key]) !== normal(value))

function findEntry(list, id) {
  const entry = list.id(id)
  if (!entry) throw new AppError('NOT_FOUND')
  return entry
}

export async function addEntry(user, profile, kind, body) {
  const { field, ongoing, none, max } = ENTRY_KINDS[kind]
  if (profile[field].length >= max) throw fieldError({ [field]: 'too_many' }, { max })
  profile[field].push(entryFields(body, ongoing))
  profile[none] = false
  await saveProfile(user, profile)
}

export async function updateEntry(user, profile, kind, id, body) {
  const { field, category, ongoing } = ENTRY_KINDS[kind]
  const entry = findEntry(profile[field], id)
  const fields = entryFields(body, ongoing)
  if (changed(entry, fields)) await resetSubmissions(user._id, { category, entryId: entry._id })
  entry.set(fields)
  await saveProfile(user, profile)
}

export async function deleteEntry(user, profile, kind, id) {
  const { field, category } = ENTRY_KINDS[kind]
  const entry = findEntry(profile[field], id)
  entry.deleteOne()
  await resetSubmissions(user._id, { category, entryId: entry._id }, { withdraw: true })
  await saveProfile(user, profile)
}

/** "No work experience yet" / "No formal qualification": only while the list is empty. */
export async function setNone(user, profile, kind, none) {
  const { field, none: flag } = ENTRY_KINDS[kind]
  if (none && profile[field].length > 0) throw fieldError({ none: 'not_allowed' })
  profile[flag] = none
  await saveProfile(user, profile)
}

/* ---------- languages, right to work, links ---------- */

function firstDuplicate(values) {
  return values.find((value, index) => values.indexOf(value) !== index)
}

/** M-020, P3-D5 */
export async function setLanguages(user, profile, { languages }) {
  const duplicate = firstDuplicate(languages.map((language) => language.code))
  if (duplicate) throw fieldError({ languages: 'duplicate' }, { code: duplicate })
  profile.languages = languages
  await saveProfile(user, profile)
}

/** M-021, P3-D4: one entry per region; entries keep their id so a changed or removed one resets its check (U27). */
export async function setRightToWork(user, profile, { rightToWork }) {
  if (firstDuplicate(rightToWork.map((entry) => entry.region))) throw fieldError({ rightToWork: 'duplicate' })
  const next = rightToWork.map((entry, index) => {
    if (entry.status !== 'visa_permit') return { ...entry, permitExpiresOn: undefined }
    if (!entry.permitExpiresOn) throw fieldError({ [`rightToWork.${index}.permitExpiresOn`]: 'required' })
    return entry
  })
  // A copy: entries are removed while looping.
  for (const entry of profile.rightToWork.slice()) {
    const update = next.find((item) => item.region === entry.region)
    if (!update) {
      entry.deleteOne()
      await resetSubmissions(user._id, { category: 'right_to_work', entryId: entry._id }, { withdraw: true })
    } else if (changed(entry, update)) {
      entry.set(update)
      await resetSubmissions(user._id, { category: 'right_to_work', entryId: entry._id })
    }
  }
  for (const entry of next) if (!profile.rightToWork.some((item) => item.region === entry.region)) profile.rightToWork.push(entry)
  await saveProfile(user, profile)
}

/** M-022 */
export async function setLinks(user, profile, { linkedin, portfolio }) {
  profile.links = { linkedin: linkedin || undefined, portfolio: portfolio || undefined }
  await saveProfile(user, profile)
}

/* ---------- photo and certificates ---------- */

// Read as values: a nested path is a live view of the document.
const photoFileIds = (profile) => [profile.photo?.fileId, profile.photo?.smallFileId]

/** M-013: a square cover crop stored at 400×400 and 96×96. */
export async function setPhoto(user, profile, upload) {
  const sizes = await Promise.all([squareWebp(upload.buffer, 400), squareWebp(upload.buffer, 96)])
  const [large, small] = await Promise.all(
    sizes.map((buffer) => storeFile({ ownerId: user._id, purpose: 'photo', buffer, ext: 'webp', originalName: upload.originalname })),
  )
  const previous = photoFileIds(profile)
  profile.photo = { fileId: large._id, smallFileId: small._id }
  await saveProfile(user, profile)
  await removeFiles(previous)
}

export async function removePhoto(user, profile) {
  const previous = photoFileIds(profile)
  profile.photo = undefined
  await saveProfile(user, profile)
  await removeFiles(previous)
}

/** M-025, P3-D3 */
function certificateFields(body) {
  if (body.expiresOn && body.expiresOn < body.issuedOn) throw fieldError({ expiresOn: 'before_start' })
  return { ...body, expiresOn: body.expiresOn ?? undefined, url: body.url || undefined }
}

export async function addCertificate(user, profile, body) {
  if (profile.certificates.length >= P.certificates.max) throw fieldError({ certificates: 'too_many' }, { max: P.certificates.max })
  profile.certificates.push(certificateFields(body))
  await saveProfile(user, profile)
}

export async function updateCertificate(user, profile, id, body) {
  const certificate = findEntry(profile.certificates, id)
  const fields = certificateFields(body)
  if (changed(certificate, fields)) await resetSubmissions(user._id, { category: 'certificate', entryId: certificate._id })
  certificate.set(fields)
  await saveProfile(user, profile)
}

export async function deleteCertificate(user, profile, id) {
  const certificate = findEntry(profile.certificates, id)
  certificate.deleteOne()
  await resetSubmissions(user._id, { category: 'certificate', entryId: certificate._id }, { withdraw: true })
  await saveProfile(user, profile)
  await removeFiles([certificate.fileId])
}

/** A new file replaces the old one; evidence about the old file no longer counts (U27). */
export async function setCertificateFile(user, profile, id, upload) {
  const certificate = findEntry(profile.certificates, id)
  const buffer = await sanitizedUpload(upload)
  const file = await storeFile({ ownerId: user._id, purpose: 'certificate_file', buffer, ext: upload.ext, originalName: upload.originalname })
  const previous = certificate.fileId
  certificate.fileId = file._id
  await resetSubmissions(user._id, { category: 'certificate', entryId: certificate._id }, { withdraw: true })
  await saveProfile(user, profile)
  await removeFiles([previous])
}

export async function removeCertificateFile(user, profile, id) {
  const certificate = findEntry(profile.certificates, id)
  const previous = certificate.fileId
  certificate.fileId = undefined
  await resetSubmissions(user._id, { category: 'certificate', entryId: certificate._id }, { withdraw: true })
  await saveProfile(user, profile)
  await removeFiles([previous])
}

/* ---------- privacy (M-187) ---------- */

export function privacyDto(user) {
  const { discoverable, resumeVisible, matchingConsent } = user.privacy
  return { discoverable, resumeVisible, matchingConsent }
}

export async function updatePrivacy(user, body) {
  for (const [key, value] of Object.entries(body)) if (value !== undefined) user.privacy[key] = value
  await user.save()
}
