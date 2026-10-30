import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import { config } from '../config/env.js'
import { ENUMS } from '../config/enums.js'
import { ScheduledTask } from '../jobs/models.js'
import { connectDb, disconnectDb } from '../lib/db.js'
import { AdminRole, AuditEvent } from '../modules/admin/admin.model.js'
import { EmailToken, VerificationCode } from '../modules/auth/auth.model.js'
import { checkPassword, hashPassword } from '../modules/auth/auth.service.js'
import { CandidateProfile } from '../modules/candidates/candidates.model.js'
import { CvVersion } from '../modules/cv/cv.model.js'
import { File, FileAccessLog } from '../modules/files/files.model.js'
import { Country } from '../modules/meta/meta.model.js'
import { currentLegalVersions } from '../modules/meta/meta.service.js'
import { User } from '../modules/users/users.model.js'
import { VerificationSubmission } from '../modules/verification/verification.model.js'
import { seedCandidates } from './candidates.js'
import { CANDIDATES, CITY_TIME_ZONES } from './data/candidates.js'
import { DEMO_ACCOUNTS } from './data/demo.js'
import { PLACES } from './data/places.js'

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
  for (const account of demoAccounts) {
    try {
      checkPassword(config.seed.password, account.email)
    } catch (error) {
      throw new Error(`SEED_PASSWORD does not meet the password rules (${Object.values(error.fields ?? {}).join(', ')})`)
    }
  }

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
  ])
  // Every stored file is demo data: one folder per purpose under the upload root (never another root).
  await Promise.all(ENUMS.filePurpose.map((purpose) => rm(join(config.uploadRoot, purpose), { recursive: true, force: true })))

  const now = new Date()
  const passwordHash = await hashPassword(config.seed.password)
  const legal = { ...(await currentLegalVersions()), acceptedAt: now }
  const languages = Object.fromEntries((await Country.find({}, 'code defaultLanguage')).map((c) => [c.code, c.defaultLanguage]))

  await User.insertMany(
    [...demoAccounts, ...people].map(({ country, ...account }) => ({
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
}

if (import.meta.main) {
  await connectDb()
  await seedDemo()
  const [accounts, profiles, files] = await Promise.all([User.countDocuments(), CandidateProfile.countDocuments(), File.countDocuments()])
  console.log(`seed:demo done: ${accounts} accounts (Owner + ${DEMO_ACCOUNTS.length - 1} demo accounts), ${profiles} candidate profiles, ${files} files`)
  await disconnectDb()
}
