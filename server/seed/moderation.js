import { AuditEvent } from '../modules/admin/admin.model.js'
import { Company } from '../modules/companies/companies.model.js'
import { Job } from '../modules/jobs/jobs.model.js'
import { MatchingPolicy } from '../modules/matching/matching.model.js'
import { ModerationCase } from '../modules/moderation/moderation.model.js'
import { User } from '../modules/users/users.model.js'

/*
 * §3.20, Phase 10 task 9: the two content reports of the moderation mock as open cases, and the audit history of the
 * audit mock as real events (P10-C16). The mock's free-text reasons map to the report reasons (U20); the reporters are
 * seeded people who can report that target (a candidate reports a job, a recruiter a candidate profile). Dates keep
 * the mock's order, counted back from the seed run.
 */
const MINUTE = 60 * 1000
const DAY = 24 * 60 * MINUTE

export async function seedModeration({ emailOf, owner, now }) {
  const [emma, alex, sarah, james] = await Promise.all(['emma', 'alex', 'sarah', 'james'].map((tag) => User.findOne({ email: emailOf({ tag }) })))
  const job = await Job.findOne({ title: 'Product Designer, Growth' })
  const jobOwner = await Company.findById(job.companyId, 'ownerUserId')
  const [sarahCompany, jamesCompany] = await Promise.all([Company.findOne({ ownerUserId: sarah._id }), Company.findOne({ ownerUserId: james._id })])
  const policy = await MatchingPolicy.findOne({ status: 'active' })

  const jobReportAt = new Date(now - 2 * DAY)
  const profileReportAt = new Date(jobReportAt.getTime() + 50 * MINUTE)
  await ModerationCase.create([
    {
      targetType: 'job',
      targetId: job._id,
      targetName: job.title,
      ownerId: jobOwner.ownerUserId,
      reports: [{ reporterId: emma._id, reason: 'discriminatory', details: 'Potentially unclear or exclusionary requirements: please check whether every criterion is genuinely essential.', at: jobReportAt }],
      openedBy: 'user',
      history: [{ action: 'opened', at: jobReportAt }],
    },
    {
      targetType: 'candidate_profile',
      targetId: alex._id,
      targetName: alex.fullName,
      ownerId: alex._id,
      reports: [{ reporterId: sarah._id, reason: 'misleading', details: 'A profile statement needs contextual review.', at: profileReportAt }],
      openedBy: 'user',
      history: [{ action: 'opened', at: profileReportAt }],
    },
  ])

  const start = now - 45 * DAY
  const admin = { type: 'admin', id: owner._id, name: owner.fullName }
  const user = (person) => ({ type: 'user', id: person._id, name: person.fullName })
  await AuditEvent.insertMany([
    { type: 'workspace.initialized', category: 'workspace', actor: admin, params: {}, at: new Date(start) },
    { type: 'policy.activated', category: 'policy', actor: admin, target: { type: 'matching_policy', id: policy._id }, params: { name: policy.name, version: policy.version }, at: new Date(start + 5 * MINUTE) },
    {
      type: 'moderation.account_approved',
      category: 'moderation',
      actor: admin,
      target: { type: 'user', id: sarah._id },
      params: { name: sarah.fullName, company: sarahCompany.legalName },
      at: new Date(start + 40 * MINUTE),
    },
    {
      type: 'moderation.account_submitted',
      category: 'moderation',
      actor: user(james),
      target: { type: 'user', id: james._id },
      params: { name: james.fullName, company: jamesCompany.legalName },
      at: new Date(now - 5 * DAY),
    },
    {
      type: 'moderation.content_reported',
      category: 'moderation',
      actor: user(emma),
      target: { type: 'job', id: job._id },
      params: { name: job.title, targetType: 'job', reason: 'discriminatory' },
      at: jobReportAt,
    },
    {
      type: 'moderation.content_reported',
      category: 'moderation',
      actor: user(sarah),
      target: { type: 'candidate_profile', id: alex._id },
      params: { name: alex.fullName, targetType: 'candidate_profile', reason: 'misleading' },
      at: profileReportAt,
    },
  ])
}
