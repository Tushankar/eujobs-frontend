import { useMemo } from 'react'
import { useLocalStorage } from '@/hooks/useLocalStorage.js'
import { COMPANY_STORAGE_KEY, INITIAL_COMPANY } from '@/features/recruiter/company/data/company.js'
import { JOBS_STORAGE_KEY, SEED_JOBS } from '@/features/recruiter/jobs/data/jobs.js'
import { INITIAL_PROFILE, PROFILE_STORAGE_KEY } from '@/features/candidate/profile/data/profile.js'
import { JOBS } from '../data/jobs.js'
import { recruiterJobIdOf, toCandidateJob, candidateJobId } from '../data/recruiterJobs.js'

/**
 * The jobs candidates can see: the sample listings plus every job a recruiter has created, kept in step with
 * the recruiter's status (a paused, closed or removed posting leaves `jobs`). `getJob` still finds those
 * postings, so applications to them keep their details.
 */
export function useJobListings() {
  const [recruiterJobs] = useLocalStorage(JOBS_STORAGE_KEY, SEED_JOBS)
  const [company] = useLocalStorage(COMPANY_STORAGE_KEY, INITIAL_COMPANY)
  const [profile] = useLocalStorage(PROFILE_STORAGE_KEY, INITIAL_PROFILE)

  return useMemo(() => {
    const listed = new Set(JOBS.map((job) => job.id))
    const created = recruiterJobs
      .filter((job) => job.status !== 'draft' && !listed.has(candidateJobId(job.id)))
      .map((job) => toCandidateJob(job, company, profile))
    const all = [...created, ...JOBS]
    const published = new Set(recruiterJobs.filter((job) => job.status === 'published').map((job) => job.id))
    const jobs = all.filter((job) => {
      const recruiterJobId = recruiterJobIdOf(job.id)
      return recruiterJobId === null || published.has(recruiterJobId)
    })
    return { jobs, getJob: (jobId) => all.find((job) => job.id === jobId) }
  }, [recruiterJobs, company, profile])
}
