import { storeFile } from '../lib/files.js'
import { Application, PipelineStage } from '../modules/applications/applications.model.js'
import { AgencyAgreement, AgencyClient, AgencyMembership, AgencyPlacement } from '../modules/agencies/agencies.model.js'
import { clientNameKey } from '../modules/agencies/agencies.service.js'
import { addDays } from '../modules/agencies/lock.js'
import { fromJob, rulesFrom } from '../modules/agencies/placements.service.js'
import { RULES } from '../modules/agencies/rules.schema.js'
import { Company } from '../modules/companies/companies.model.js'
import { Job } from '../modules/jobs/jobs.model.js'
import { notify } from '../modules/notifications/notifications.service.js'
import { User } from '../modules/users/users.model.js'
import { seedApplication } from './applications.js'
import { pdf } from './candidates.js'
import { AGENCIES } from './data/agencies.js'
import { CANDIDATES } from './data/candidates.js'
import { CITY_CURRENCY } from './data/employers.js'
import { PLACES } from './data/places.js'
import { COMPANIES } from './data/recruiters.js'
import { SECTORS } from './data/sectors.js'
import { jobDoc, logoBuffer, restoreFile, seedApprovedCompany, storeLogo } from './recruiters.js'

/*
 * 2026-11-26: the two agencies of data/agencies.js. Every step adds only what is missing, so seed:demo (after its wipe)
 * and scripts/addSectorJobs.js (on the live database, on each machine) share it. Records are written directly, as the
 * rest of the seed: no emails; the two waiting events (a join request, an invitation) get their bell notification.
 */
const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS
const ago = (now, days) => new Date(now - days * DAY_MS)
const dayOf = (now, offset) => addDays(new Date(now).toISOString().slice(0, 10), offset)
const sectorName = (key) => SECTORS.find((sector) => sector.key === key).name.en

// The agreement PDF holds every clause word for word; a fixed date gives the same bytes on every machine.
const agreementPdf = (agency) =>
  pdf(
    [
      { text: `${agency.name}: candidate agreement`, size: 18 },
      'Version 1',
      'Sample document created for the demo data. It is not a real agreement.',
      { text: 'Assignments', size: 14 },
      ...RULES.filter((name) => agency.agreement.rules[name]).map((name) => agency.agreement.rules[name][1]),
    ],
    { CreationDate: new Date(Date.UTC(2026, 10, 26)) },
  )

async function seedClients(agency, company, user, emailOf) {
  const clients = {}
  for (const data of agency.clients) {
    const nameKey = clientNameKey(data.name)
    let client = await AgencyClient.findOne({ companyId: company._id, nameKey })
    if (!client) {
      const employer = data.linked && (await User.findOne({ email: emailOf(COMPANIES.find((item) => item.key === data.linked).recruiter) }, 'companyId'))
      const logo = await storeLogo(user._id, data.key, 'client_logo')
      client = await AgencyClient.create({
        companyId: company._id,
        name: data.name,
        nameKey,
        sector: data.sector,
        industry: sectorName(data.sector),
        location: PLACES[data.city],
        logoFileId: logo?._id,
        linkedCompanyId: employer?.companyId ?? undefined,
      })
    }
    await restoreFile(client.logoFileId, `${data.key}.png`, () => logoBuffer(data.key))
    clients[data.key] = client
  }
  return clients
}

async function seedAgreement(agency, company, user, now) {
  const { fileName, publishedDaysAgo, rules } = agency.agreement
  let agreement = await AgencyAgreement.findOne({ companyId: company._id, version: 1 })
  if (!agreement) {
    const file = await storeFile({ ownerId: user._id, purpose: 'agency_agreement', buffer: await agreementPdf(agency), ext: 'pdf', originalName: fileName })
    const at = ago(now, publishedDaysAgo)
    agreement = await AgencyAgreement.create({
      companyId: company._id,
      version: 1,
      status: 'published',
      file: { fileId: file._id, name: fileName, size: file.size },
      rules: Object.fromEntries(RULES.map((name) => [name, rules[name] ? { value: rules[name][0], clause: rules[name][1] } : { value: null, clause: null }])),
      uploadedBy: user._id,
      publishedAt: at,
      publishedBy: user._id,
      createdAt: at,
    })
  }
  await restoreFile(agreement.file.fileId, fileName, () => agreementPdf(agency))
  return agreement
}

/** The agency's jobs by title; a filled one (`closed`) closed when its placement started. */
async function seedJobs(agency, company, user, clients, now) {
  const jobs = {}
  for (const { client, showClient, startInDays, weeks, rate, hoursPerWeek, closed, ...data } of agency.jobs) {
    let job = await Job.findOne({ companyId: company._id, title: data.title })
    if (!job) {
      const startDate = dayOf(now, startInDays)
      job = await Job.create({
        ...jobDoc(data, { company, recruiter: user, now }),
        agency: {
          clientId: clients[client]._id,
          showClient,
          startDate,
          endDate: addDays(startDate, weeks * 7 - 1),
          rate: { amountMinor: Math.round(rate[0] * 100), currency: data.city === 'remote' ? agency.currency : CITY_CURRENCY[data.city], period: rate[1] },
          hoursPerWeek,
        },
        ...(closed && { status: 'closed', closedAt: new Date(now + startInDays * DAY_MS) }),
      })
    }
    jobs[job.title] = job
  }
  return jobs
}

/**
 * The books: a candidate who asked (requested → awaiting agreement once the agency accepts) or was invited (awaiting
 * agreement), active from the day they agreed to version 1. Waiting ones get the bell notification of their event.
 */
async function seedBooks(agency, company, user, agreement, now, person) {
  for (const entry of agency.books) {
    const candidate = await person(entry.person)
    if (!candidate || (await AgencyMembership.exists({ companyId: company._id, candidateId: candidate._id }))) continue
    const started = ago(now, entry.startedDaysAgo)
    const history = [{ status: entry.by === 'candidate' ? 'requested' : 'awaiting_agreement', by: entry.by, at: started }]
    const agreedAt = entry.agreedDaysAgo != null && ago(now, entry.agreedDaysAgo)
    if (agreedAt) {
      if (entry.by === 'candidate') history.push({ status: 'awaiting_agreement', by: 'agency', at: new Date(started.getTime() + 6 * HOUR_MS) })
      history.push({ status: 'active', by: 'candidate', at: agreedAt })
    }
    await AgencyMembership.create({
      companyId: company._id,
      candidateId: candidate._id,
      status: history.at(-1).status,
      requestedBy: entry.by,
      acceptances: agreedAt ? [{ version: agreement.version, name: candidate.fullName, at: agreedAt }] : [],
      history,
      createdAt: started,
    })
    if (history.at(-1).status === 'requested') await notify(user, 'agency_join_requested', { params: { candidate: candidate.fullName }, target: { kind: 'page', id: 'talentRequests' }, at: started })
    else if (!agreedAt) await notify(candidate, 'agency_invited', { params: { agency: company.displayName }, target: { kind: 'page', id: 'myAgencies' }, at: started })
  }
}

/** Each placement: an application moved to Hired, and the confirmed placement with the agreement's rules. */
async function seedPlacements(agency, company, user, agreement, jobs, now, person) {
  const stages = new Map((await PipelineStage.find({ companyId: company._id })).map((stage) => [stage.category, stage]))
  for (const { person: name, job: title, appliedDaysAgo, path } of agency.placements) {
    const candidate = await person(name)
    const job = jobs[title]
    if (!candidate || (await Application.exists({ candidateId: candidate._id, jobId: job._id }))) continue
    const application = await seedApplication({ candidate, job, recruiter: user, stages, appliedAt: ago(now, appliedDaysAgo), path })
    const hiredAt = application.history.at(-1).at
    await AgencyPlacement.create({
      ...(await fromJob(job, candidate._id)),
      ...rulesFrom(job, agreement),
      applicationId: application._id,
      status: 'confirmed',
      confirmedAt: hiredAt,
      decidedAt: hiredAt,
      createdAt: hiredAt,
    })
  }
}

export async function seedAgencies({ emailOf, owner, now }) {
  // A seeded candidate, or null when this database no longer has them (the live one).
  const person = (fullName) => User.findOne({ email: emailOf(CANDIDATES.find((candidate) => candidate.fullName === fullName)), role: 'candidate', status: 'active' })
  for (const agency of AGENCIES) {
    const user = await User.findOne({ email: emailOf(agency.recruiter), role: 'agency' })
    if (!user) continue
    const company = (await Company.findOne({ ownerUserId: user._id })) ?? (await seedApprovedCompany({ owner, recruiter: user, now, data: agency }))
    await restoreFile(company.logoFileId, `${agency.key}.png`, () => logoBuffer(agency.key))
    const clients = await seedClients(agency, company, user, emailOf)
    const agreement = await seedAgreement(agency, company, user, now)
    const jobs = await seedJobs(agency, company, user, clients, now)
    await seedBooks(agency, company, user, agreement, now, person)
    await seedPlacements(agency, company, user, agreement, jobs, now, person)
  }
}
