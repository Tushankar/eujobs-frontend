import { formatSalary } from '@/features/recruiter/jobs/data/jobFields.js'

/**
 * Review item for a recruiter job that has no reported-content entry (the Jobs page links every job to
 * /admin/moderation/content/:jobId). It carries the job's own details instead of a report.
 */
export function jobToReviewItem(job) {
  const skills = [...(job.requiredSkills ?? []), ...(job.preferredSkills ?? [])]
  return {
    id: job.id,
    title: job.title,
    kind: 'Job listing',
    priority: 'standard',
    details: {
      company: job.company,
      location: [job.location, job.workPreference].filter(Boolean).join(' · '),
      salary: formatSalary(job),
      skills,
      description: job.description,
    },
  }
}
