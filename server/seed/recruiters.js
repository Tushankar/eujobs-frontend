import { existsSync, readFileSync } from 'node:fs'
import sharp from 'sharp'
import { storeFile } from '../lib/files.js'
import { createDefaultStages } from '../modules/companies/companies.review.js'
import { Company, KycDocument } from '../modules/companies/companies.model.js'
import { ProfileView, RecruiterActivity, ShortlistEntry } from '../modules/discovery/discovery.model.js'
import { Job, SavedJob } from '../modules/jobs/jobs.model.js'
import { User } from '../modules/users/users.model.js'
import { pdf } from './candidates.js'
import { CANDIDATES } from './data/candidates.js'
import { PLACES } from './data/places.js'
import { ACME_SHORTLIST, ALEX_SAVED_JOBS, APPLICANT_COMPANY, COMPANIES, JOBS, PROFILE_VIEWS } from './data/recruiters.js'

/*
 * Companies, jobs and recruiter activity for seed:demo (§3.20, OQ-4, P4-C). Approved companies were reviewed
 * more than 30 days ago, so their KYC files are already gone (M-186) and only the records remain. James Chen's
 * applicant company has generated sample KYC files and waits for review.
 */
const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS
const skills = (names) => names.map((name) => ({ name, key: name.toLocaleLowerCase() }))
const ago = (now, ms) => new Date(now - ms)
// Real-brand demo companies get their public logo (owner request 2026-11-11); fictional ones keep their initials.
const logoPath = (key) => new URL(`./assets/logos/${key}.png`, import.meta.url)

async function seedLogo(company, ownerId, key) {
  if (!existsSync(logoPath(key))) return
  const buffer = await sharp(readFileSync(logoPath(key))).resize(256, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer()
  const file = await storeFile({ ownerId, purpose: 'company_logo', buffer, ext: 'png', originalName: `${key}.png` })
  company.logoFileId = file._id
  await company.save()
}

async function seedCompany({ owner, recruiter, now, data, status }) {
  const company = await Company.create({
    ownerUserId: recruiter._id,
    legalName: data.legalName ?? data.name,
    displayName: data.name,
    website: data.website ?? `https://${data.key}.example.com`,
    businessEmail: data.businessEmail ?? `hiring@${data.key}.example.com`,
    industry: data.industry,
    size: data.size,
    location: PLACES[data.city],
    businessAddress: data.businessAddress ?? `${PLACES[data.city].city} (sample address)`,
    registrationDetails: data.registrationDetails,
    description: data.description,
    submittedAt: ago(now, (data.approvedDaysAgo ?? 45) * DAY_MS + DAY_MS),
    ...(status === 'active' && {
      verifiedAt: ago(now, (data.approvedDaysAgo ?? 45) * DAY_MS),
      reviewHistory: [{ decision: 'approved', by: owner._id, at: ago(now, (data.approvedDaysAgo ?? 45) * DAY_MS) }],
    }),
  })
  await seedLogo(company, recruiter._id, data.key)
  recruiter.companyId = company._id
  recruiter.phone = { e164: data.phone ?? recruiter.phone?.e164 ?? '+442079460200', verifiedAt: company.submittedAt }
  await recruiter.save()
  return company
}

export async function seedRecruiters({ emailOf, owner, now }) {
  const companies = {}
  for (const data of COMPANIES) {
    const recruiter = await User.findOne({ email: emailOf(data.recruiter) })
    const company = await seedCompany({ owner, recruiter, now, data, status: 'active' })
    // Reviewed over 30 days ago: the KYC records stay, the files were deleted (M-186).
    await KycDocument.insertMany(['identity', 'registration'].map((type) => ({ companyId: company._id, userId: recruiter._id, type, uploadedAt: company.submittedAt })))
    await createDefaultStages(company, recruiter.language)
    companies[data.key] = { company, recruiter }
  }

  // OQ-4.1: the recruiter applicant, with generated sample KYC files.
  const james = await User.findOne({ email: emailOf({ tag: 'james' }) })
  const applicant = await seedCompany({ owner, recruiter: james, now, data: { key: 'chen', ...APPLICANT_COMPANY, approvedDaysAgo: APPLICANT_COMPANY.submittedDaysAgo - 1 }, status: 'pending_review' })
  const sample = 'Sample document created for the demo data. It is not a real document.'
  const identity = await pdf([{ text: 'Identity document (sample)', size: 18 }, james.fullName, sample])
  const registrationSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="560"><rect width="800" height="560" fill="#f8f9fb"/><text x="60" y="120" font-family="Arial" font-size="40" font-weight="700" fill="#202534">Certificate of registration (sample)</text><text x="60" y="200" font-family="Arial" font-size="28" fill="#202534">${APPLICANT_COMPANY.name}</text><text x="60" y="260" font-family="Arial" font-size="22" fill="#687184">${sample}</text></svg>`
  const registration = await sharp(Buffer.from(registrationSvg)).png().toBuffer()
  for (const [type, buffer, ext, originalName] of [
    ['identity', identity, 'pdf', 'passport.pdf'],
    ['registration', registration, 'png', 'company-registration.png'],
  ]) {
    const file = await storeFile({ ownerId: james._id, purpose: 'kyc', buffer, ext, originalName })
    await KycDocument.create({ companyId: applicant._id, userId: james._id, type, fileId: file._id, uploadedAt: applicant.submittedAt })
  }

  const jobs = []
  for (const { company: key, city, hoursAgo, requiredSkills, preferredSkills, ...fields } of JOBS) {
    const { company, recruiter } = companies[key]
    const publishedAt = ago(now, hoursAgo * HOUR_MS)
    jobs.push(
      await Job.create({
        ...fields,
        companyId: company._id,
        createdBy: recruiter._id,
        requiredSkills: skills(requiredSkills),
        preferredSkills: skills(preferredSkills),
        country: city === 'remote' ? 'REMOTE' : PLACES[city].countryCode,
        location: city === 'remote' ? undefined : PLACES[city],
        status: 'published',
        publishedAt,
        firstPublishedAt: publishedAt,
        createdAt: publishedAt,
      }),
    )
  }

  // The recruiter mocks: Acme's shortlist (with its activity), Alex's saved jobs and the profile-views KPI.
  const acme = companies.acme
  const person = async (fullName) => User.findOne({ email: emailOf(CANDIDATES.find((candidate) => candidate.fullName === fullName)) })
  for (const [index, fullName] of ACME_SHORTLIST.entries()) {
    const candidate = await person(fullName)
    const at = ago(now, (index + 3) * DAY_MS)
    await ShortlistEntry.create({ companyId: acme.company._id, candidateId: candidate._id, addedBy: acme.recruiter._id, createdAt: at })
    await RecruiterActivity.create({ companyId: acme.company._id, candidateId: candidate._id, actorId: acme.recruiter._id, type: 'shortlisted', at })
  }
  const alex = await person('Alex Morgan')
  for (const saved of ALEX_SAVED_JOBS) {
    const job = jobs.find((item) => String(item.companyId) === String(companies[saved.company].company._id) && item.title === saved.title)
    await SavedJob.create({ candidateId: alex._id, jobId: job._id })
  }
  // Alex's profile is incomplete, so no recruiter can open it (P4-D11); Emma, the complete demo candidate, has the views.
  const emma = await person('Emma Wilson')
  const recruiters = Object.values(companies).map(({ company, recruiter }) => ({ company, recruiter }))
  const views = []
  const spread = (count, fromDay) => {
    for (let index = 0; index < count; index++) {
      const { company, recruiter } = recruiters[index % recruiters.length]
      const at = ago(now, (fromDay + Math.floor(index / recruiters.length) * 7 + (index % recruiters.length) * 2) * DAY_MS + HOUR_MS)
      views.push({ candidateId: emma._id, recruiterId: recruiter._id, companyId: company._id, day: at.toISOString().slice(0, 10), at })
    }
  }
  spread(PROFILE_VIEWS.last30, 1)
  spread(PROFILE_VIEWS.previous30, 31)
  await ProfileView.insertMany(views)
}
