import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import { config } from '../config/env.js'
import { ENUMS } from '../config/enums.js'
import { ScheduledTask } from '../jobs/models.js'
import { connectDb, disconnectDb } from '../lib/db.js'
import { AdminRole, AuditEvent } from '../modules/admin/admin.model.js'
import { Application, PipelineStage } from '../modules/applications/applications.model.js'
import { EmailToken, VerificationCode } from '../modules/auth/auth.model.js'
import { checkPassword, hashPassword } from '../modules/auth/auth.service.js'
import { CandidateProfile } from '../modules/candidates/candidates.model.js'
import { Company, KycDocument } from '../modules/companies/companies.model.js'
import { CvAccessRequest, CvVersion } from '../modules/cv/cv.model.js'
import { CandidateNote, ProfileView, RecruiterActivity, ShortlistEntry } from '../modules/discovery/discovery.model.js'
import { File, FileAccessLog } from '../modules/files/files.model.js'
import { Job, SavedJob } from '../modules/jobs/jobs.model.js'
import { Course, Enrollment } from '../modules/learning/learning.model.js'
import { Country } from '../modules/meta/meta.model.js'
import { currentLegalVersions } from '../modules/meta/meta.service.js'
import { Counter, Payment, StripeEvent, Subscription } from '../modules/payments/payments.model.js'
import { User } from '../modules/users/users.model.js'
import { VerificationSubmission } from '../modules/verification/verification.model.js'
import { seedApplications } from './applications.js'
import { seedCandidates } from './candidates.js'
import { CANDIDATES, CITY_TIME_ZONES } from './data/candidates.js'
import { DEMO_ACCOUNTS } from './data/demo.js'
import { PLACES } from './data/places.js'
import { COMPANIES } from './data/recruiters.js'
import { seedPayments } from './payments.js'
import { seedRecruiters } from './recruiters.js'
import { deleteDatabaseCustomers } from './stripe.js'

/*
 * seed:demo (U41): wipes the demo data and recreates it. Email logs and daily job runs are kept,
 * so re-seeding never resets the Gmail cap. Run seed:catalog first (countries are read from it).
 */

/** `<local>+<tag>@<domain>` of SEED_ADMIN_EMAIL (P12); no address is hard-coded. */
export function demoAddress(tag) {
  if (!tag) return config.seed.adminEmail
  const [local, domain] = config.seed.adminEmail.split('@')
  return `${local}+${tag}@${domain}`
}

/** The address of a seeded person: a demo plus-alias, or their example.com address (OD9). */
const emailOf = (person) => person.email ?? demoAddress(person.tag)

export async function seedDemo() {
  const demoAccounts = DEMO_ACCOUNTS.map(({ tag, ...account }) => ({ ...account, email: demoAddress(tag) }))
  // The recruiter-mock candidates (§3.20) that are not demo accounts.
  const people = CANDIDATES.filter((person) => person.email).map((person) => ({
    role: 'candidate',
    status: 'active',
    fullName: person.fullName,
    email: person.email,
    country: PLACES[person.city].countryCode,
    timezone: CITY_TIME_ZONES[person.city],
  }))
  // One approved recruiter per mock company (M-145); Acme's is Sarah, a demo account.
  const recruiters = COMPANIES.filter((company) => company.recruiter.email).map((company) => ({
    role: 'recruiter',
    status: 'active',
    fullName: company.recruiter.fullName,
    email: company.recruiter.email,
    jobTitle: 'Talent lead',
    country: PLACES[company.city].countryCode,
    timezone: CITY_TIME_ZONES[company.city],
  }))
  for (const account of demoAccounts) {
    try {
      checkPassword(config.seed.password, account.email)
    } catch (error) {
      throw new Error(`SEED_PASSWORD does not meet the password rules (${Object.values(error.fields ?? {}).join(', ')})`)
    }
  }

  // P5-Q3: the Stripe customers of this database's users go with them (seed ones included, OD8).
  await deleteDatabaseCustomers(config.dbName, await User.distinct('stripeCustomerId', { stripeCustomerId: { $type: 'string' } }))
  await Promise.all([
    User.deleteMany({}),
    EmailToken.deleteMany({}),
    VerificationCode.deleteMany({}),
    ScheduledTask.deleteMany({}),
    AuditEvent.deleteMany({}),
    AdminRole.deleteMany({ system: { $ne: true } }),
    CandidateProfile.deleteMany({}),
    CvVersion.deleteMany({}),
    VerificationSubmission.deleteMany({}),
    File.deleteMany({}),
    FileAccessLog.deleteMany({}),
    Company.deleteMany({}),
    KycDocument.deleteMany({}),
    PipelineStage.deleteMany({}),
    Application.deleteMany({}),
    Job.deleteMany({}),
    SavedJob.deleteMany({}),
    ShortlistEntry.deleteMany({}),
    CandidateNote.deleteMany({}),
    RecruiterActivity.deleteMany({}),
    ProfileView.deleteMany({}),
    CvAccessRequest.deleteMany({}),
    Subscription.deleteMany({}),
    Payment.deleteMany({}),
    Counter.deleteMany({}),
    StripeEvent.deleteMany({}),
    Course.deleteMany({}),
    Enrollment.deleteMany({}),
  ])
  // Every stored file is demo data: one folder per purpose under the upload root (never another root).
  await Promise.all(ENUMS.filePurpose.map((purpose) => rm(join(config.uploadRoot, purpose), { recursive: true, force: true })))

  const now = new Date()
  const passwordHash = await hashPassword(config.seed.password)
  const legal = { ...(await currentLegalVersions()), acceptedAt: now }
  const languages = Object.fromEntries((await Country.find({}, 'code defaultLanguage')).map((c) => [c.code, c.defaultLanguage]))

  await User.insertMany(
    [...demoAccounts, ...people, ...recruiters].map(({ country, ...account }) => ({
      ...account,
      passwordHash,
      legal,
      emailVerifiedAt: now,
      language: country ? languages[country] : 'en',
      pickerCountry: country,
      onboardingCompletedAt: account.role === 'candidate' ? now : undefined,
    })),
  )
  const owner = await User.findOne({ isOwner: true })
  await seedCandidates({ emailOf, owner, now: now.getTime() })
  await seedRecruiters({ emailOf, owner, now: now.getTime() })
  await seedPayments({ emailOf, now: now.getTime() })
  await seedApplications({ emailOf, now: now.getTime() })
}

if (import.meta.main) {
  await connectDb()
  await seedDemo()
  const models = [User, CandidateProfile, Company, Job, File, Payment]
  const [accounts, profiles, companies, jobs, files, payments] = await Promise.all(models.map((Model) => Model.countDocuments()))
  console.log(
    `seed:demo done: ${accounts} accounts (Owner + ${DEMO_ACCOUNTS.length - 1} demo accounts), ${profiles} candidate profiles, ${companies} companies, ${jobs} jobs, ${files} files, ${payments} payments`,
  )
  await disconnectDb()
}
