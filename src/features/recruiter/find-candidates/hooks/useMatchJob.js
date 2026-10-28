import { useSharedLocalStorage } from '@/hooks/useSharedLocalStorage.js'
import { useJobs } from '@/features/recruiter/jobs/hooks/useJobs.js'

const MATCH_JOB_STORAGE_KEY = 'lwm.recruiter.match-job'
const DEFAULT_JOB_ID = 'senior-product-designer'

/**
 * The job candidates are matched against ("Match candidates to a job" / "Match evidence for"), shared by the
 * list and the profile and persisted on this device. Only open (published or paused) jobs can be chosen;
 * `job` is null when there are none.
 */
export function useMatchJob() {
  const { jobs } = useJobs()
  const [jobId, setJobId] = useSharedLocalStorage(MATCH_JOB_STORAGE_KEY, DEFAULT_JOB_ID)

  const openJobs = jobs.filter((job) => job.status === 'published' || job.status === 'paused')
  const job = openJobs.find((item) => item.id === jobId) ?? openJobs[0] ?? null

  return { jobs: openJobs, job, setJobId }
}
