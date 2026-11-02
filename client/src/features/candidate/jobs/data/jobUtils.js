/*
 * Helpers for the mock job data, kept only for the candidate Applications page and its AI summary dialog until
 * Phase 6 (P4-D14). Find jobs, job details and the Overview read the server since Phase 4.
 */

export function jobPath(jobId) {
  return `/candidate/jobs/${jobId}`
}

/** Recruiter postings may list a single figure; callers skip the salary when `salaryMin` is null. */
export function formatSalary(job) {
  return job.salaryMax > job.salaryMin ? `$${job.salaryMin}k – $${job.salaryMax}k` : `$${job.salaryMin}k`
}

/** Share of a job's listed skills that appear in the candidate's profile. */
export function profileMatch(job) {
  return Math.round((job.matchingSkills / job.skills.length) * 100)
}
