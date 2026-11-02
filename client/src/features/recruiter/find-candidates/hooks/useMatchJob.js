import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useSharedLocalStorage } from '@/hooks/useSharedLocalStorage.js'
import { useGetRecruiterJobsQuery } from '@/features/recruiter/jobs/api.js'

const MATCH_JOB_STORAGE_KEY = 'lwm.recruiter.match-job'

/**
 * The job candidates are matched against ("Match candidates to a job" / "Match evidence for"). M-041: the choice
 * stays in this browser; a `?jobId=` link (from Jobs) picks that job. Only published or paused jobs can be
 * chosen, and without a choice the newest published job is used (P4-D10). `job` is null when there are none.
 */
export function useMatchJob() {
  const { data } = useGetRecruiterJobsQuery()
  const [params] = useSearchParams()
  const [jobId, setJobId] = useSharedLocalStorage(MATCH_JOB_STORAGE_KEY, '')
  const linked = params.get('jobId')

  useEffect(() => {
    if (linked) setJobId(linked)
  }, [linked, setJobId])

  const openJobs = (data?.items ?? []).filter((job) => job.status === 'published' || job.status === 'paused')
  const newest = [...openJobs].filter((job) => job.status === 'published').sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))[0]
  const job = openJobs.find((item) => item.id === (linked ?? jobId)) ?? newest ?? openJobs[0] ?? null

  return { jobs: openJobs, job, setJobId, ready: Boolean(data) }
}
