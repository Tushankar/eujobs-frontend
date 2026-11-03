import { AppError } from '../../lib/errors.js'
import { accessibleCandidate } from '../discovery/discovery.service.js'
import { Job } from '../jobs/jobs.model.js'
import { jobDetails } from '../jobs/jobs.search.js'
import { matchEvidence } from '../matching/matching.evidence.js'
import { candidateFacts, candidateSubject, jobFacts, write } from './ai.facts.js'
import { PROMPTS } from './ai.prompts.js'

/*
 * Job summaries (M-058, M-059: on each candidate card, recruiter row and the admin page, with Regenerate for admins),
 * the recruiter's Match insights narrative (M-057, C6) and the candidate's recruiter-ready profile summary (M-062).
 */

/** The job a reader may summarise: a candidate's visible (or saved or applied) job, a recruiter's own, any for an admin. */
async function readableJob(user, id, company) {
  if (user.role === 'candidate') await jobDetails(user, id)
  const job = await Job.findOne({ _id: id, ...(user.role === 'recruiter' && { companyId: company._id }) })
  if (!job) throw new AppError('NOT_FOUND')
  return job
}

export async function jobSummary(user, id, { company, regenerate = false } = {}) {
  const job = await readableJob(user, id, company)
  return write(PROMPTS.jobSummary, { user, input: await jobFacts(job), regenerate })
}

/** GET /recruiter/candidates/:id/match: the narrative around the evidence the card already shows; never a score. */
export async function recruiterMatch(user, company, candidateId, jobId) {
  const { profile, user: candidate } = await accessibleCandidate(candidateId, company)
  const job = await Job.findOne({ _id: jobId, companyId: company._id })
  if (!job) throw new AppError('NOT_FOUND')
  const { facts } = await candidateSubject(candidate._id)
  const input = { candidate: facts ?? candidateFacts(profile), job: await jobFacts(job), evidence: matchEvidence(profile, job) }
  return write(PROMPTS.recruiterMatch, { user, input })
}

/** POST /candidate/profile/ai-summary (M-062): from the profile and the live CV, copyable. */
export async function profileSummary(user) {
  const { facts } = await candidateSubject(user._id)
  return write(PROMPTS.profileSummary, { user, input: { candidate: facts } })
}
