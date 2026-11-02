import mongoose from 'mongoose'
import { CandidateProfile } from '../../modules/candidates/candidates.model.js'
import { createDefaultStages } from '../../modules/companies/companies.review.js'
import { Company } from '../../modules/companies/companies.model.js'
import { CvVersion } from '../../modules/cv/cv.model.js'
import { File } from '../../modules/files/files.model.js'
import { Subscription } from '../../modules/payments/payments.model.js'
import { VerificationSubmission } from '../../modules/verification/verification.model.js'
import { PLACES } from '../../seed/data/places.js'
import { createUser } from './index.js'

/* Factories for the jobs and discovery tests: an approved recruiter with a company, and a listable candidate. */

export async function approvedRecruiter({ city = 'london', ...fields } = {}) {
  const user = await createUser({ role: 'recruiter', status: 'active', jobTitle: 'Talent lead', ...fields })
  const company = await Company.create({
    ownerUserId: user._id,
    legalName: `${user.fullName} Ltd`,
    displayName: `${user.fullName} Studio`,
    industry: 'Design services',
    size: '11_50',
    location: PLACES[city],
    verifiedAt: new Date(),
  })
  user.companyId = company._id
  await user.save()
  // Approval creates the default stages (§3.12); the factory skips the review, so it creates them too.
  await createDefaultStages(company, user.language)
  return { user, company }
}

/**
 * A candidate Find candidates can list (M-054): active, email verified, discoverable, consenting and with a
 * complete profile. `profile` overrides profile fields.
 */
export async function listedCandidate({ city = 'london', profile = {}, ...fields } = {}) {
  const user = await createUser({ role: 'candidate', ...fields })
  const skills = profile.skills ?? ['Figma', 'Design Systems']
  await CandidateProfile.create({
    userId: user._id,
    headline: 'Product Designer',
    location: PLACES[city],
    about: 'A product designer who builds calm, accessible tools for teams.',
    yearsExperience: 5,
    workPreference: 'hybrid',
    availability: 'available_now',
    languages: [{ code: 'en', level: 'native' }],
    rightToWork: [],
    workHistory: [{ title: 'Designer', employer: 'Studio North', start: '2020-01', current: true }],
    education: [{ institution: 'Art School', degree: 'BA Design', start: '2014-09', end: '2018-06' }],
    completeness: { complete: true, done: 12, total: 12, missing: [] },
    ...profile,
    skills: skills.map((name) => ({ name, key: name.toLocaleLowerCase() })),
  })
  return user
}

/** A publishable job body (M-033) for an on-site or hybrid city, or remote. */
export const jobBody = (overrides = {}) => ({
  title: 'Senior Product Designer',
  employmentType: 'full_time',
  brief: 'Lead the design of our hiring tools, from research to shipped product, with a small and kind team.',
  responsibilities: ['Run research', 'Design flows', 'Ship with engineers'],
  requiredSkills: ['Figma', 'Design Systems'],
  preferredSkills: ['Prototyping'],
  level: 'senior',
  experienceYears: 5,
  workPreference: 'hybrid',
  placeId: PLACES.london.placeId,
  salary: { min: 60000, max: 80000, period: 'year' },
  ...overrides,
})

/**
 * A candidate who passes the apply gate: a complete profile (all 12 checklist items, with a live CV version, a photo,
 * a verified phone and approved checks) and, unless `plus: false`, an active Plus subscription. Listable like
 * `listedCandidate`; `profile` overrides profile fields.
 */
export async function applicantCandidate({ plus = true, profile = {}, ...fields } = {}) {
  const user = await listedCandidate({
    phone: { e164: '+442079460000', verifiedAt: new Date() },
    ...fields,
    profile: {
      rightToWork: [{ region: 'uk', status: 'citizen_settled' }],
      links: { portfolio: 'https://portfolio.example.com' },
      photo: { fileId: new mongoose.Types.ObjectId() },
      ...profile,
    },
  })
  const file = await File.create({ ownerId: user._id, purpose: 'cv', path: 'cv/applicant.pdf', originalName: 'cv.pdf', mime: 'application/pdf', size: 1000 })
  const cv = await CvVersion.create({ userId: user._id, number: 1, fileId: file._id, originalName: 'cv.pdf', mime: 'application/pdf', size: 1000 })
  await CandidateProfile.updateOne({ userId: user._id }, { liveCvVersionId: cv._id })
  await VerificationSubmission.insertMany(['identity', 'academic', 'employment'].map((category) => ({ userId: user._id, category, status: 'approved' })))
  if (plus) await Subscription.create({ userId: user._id, planKey: 'plus', status: 'active' })
  return user
}
