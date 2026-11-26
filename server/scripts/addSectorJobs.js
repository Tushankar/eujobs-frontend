import { pathToFileURL } from 'node:url'
import { connectDb, disconnectDb } from '../lib/db.js'
import { Company } from '../modules/companies/companies.model.js'
import { Job } from '../modules/jobs/jobs.model.js'
import { scheduleRecompute } from '../modules/matching/matching.service.js'
import { User } from '../modules/users/users.model.js'
import { seedAgencies } from '../seed/agencies.js'
import { AGENCIES } from '../seed/data/agencies.js'
import { EMPLOYERS } from '../seed/data/employers.js'
import { COMPANIES, JOBS } from '../seed/data/recruiters.js'
import { emailOf, insertAccounts, seedAccounts } from '../seed/demo.js'
import { jobDoc, logoBuffer, restoreFile, seedApprovedCompany } from '../seed/recruiters.js'

/*
 * node --env-file=.env scripts/addSectorJobs.js (2026-11-26, owner): adds the sector employers, their jobs, the new
 * jobs of the mock companies and the two agencies of seed:demo to a database that was seeded before them (the shared
 * live one), without deleting or changing anything. Run it on both machines: dev and production share the database but
 * not the upload folder, so the second run finds the records and writes the logo and agreement files it is missing.
 * A mock company whose recruiter is gone is skipped. Matching (scores, "N relevant") is recomputed on the server's next
 * scheduler tick. Safe to rerun.
 */
export async function addSectorJobs({ now = Date.now() } = {}) {
  const owner = await User.findOne({ isOwner: true })
  const before = await Job.countDocuments()

  // The new employers' recruiters and the agencies' contacts that this database does not have yet.
  const wanted = new Set([...EMPLOYERS, ...AGENCIES].map((company) => emailOf(company.recruiter)))
  const accounts = []
  for (const account of seedAccounts().filter((item) => wanted.has(item.email))) if (!(await User.exists({ email: account.email }))) accounts.push(account)
  if (accounts.length) await insertAccounts(accounts, new Date(now))

  // A new employer gets its approved company; the mock companies were seeded already. Then every missing job.
  const companies = {}
  for (const data of COMPANIES) {
    const recruiter = await User.findOne({ email: emailOf(data.recruiter), role: 'recruiter' })
    if (!recruiter) continue
    let company = await Company.findOne({ ownerUserId: recruiter._id })
    if (!company && EMPLOYERS.includes(data)) company = await seedApprovedCompany({ owner, recruiter, now, data })
    if (!company) continue
    if (EMPLOYERS.includes(data)) await restoreFile(company.logoFileId, `${data.key}.png`, () => logoBuffer(data.key))
    companies[data.key] = { company, recruiter }
  }
  for (const data of JOBS) {
    const owned = companies[data.company]
    if (owned && !(await Job.exists({ companyId: owned.company._id, title: data.title }))) await Job.create(jobDoc(data, { ...owned, now }))
  }

  await seedAgencies({ emailOf, owner, now })
  const added = (await Job.countDocuments()) - before
  if (added) await scheduleRecompute('all')
  return { accounts: accounts.length, jobs: added }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await connectDb()
  const result = await addSectorJobs()
  console.log(`addSectorJobs: ${result.accounts} accounts and ${result.jobs} jobs added${result.jobs ? '; matching recomputes on the next scheduler tick' : ''}`)
  await disconnectDb()
}
