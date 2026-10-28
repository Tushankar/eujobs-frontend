import { useLocalStorage } from '@/hooks/useLocalStorage.js'
import { JOBS_STORAGE_KEY, SEED_JOBS } from '../data/jobs.js'

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Recruiter job postings persisted on this device.
 * `addJob(fields)` prepends a new job and returns its id; `updateJob(id, patch)` merges fields;
 * `setStatus(id, status)` moves a job between published / paused / draft / closed.
 */
export function useJobs() {
  const [jobs, setJobs] = useLocalStorage(JOBS_STORAGE_KEY, SEED_JOBS)

  function getJob(id) {
    return jobs.find((job) => job.id === id)
  }

  function addJob(fields) {
    const id = `${slugify(fields.title) || 'job'}-${Date.now().toString(36)}`
    setJobs((current) => [
      { relevant: 0, status: 'draft', ...fields, id, createdAt: new Date().toISOString() },
      ...current,
    ])
    return id
  }

  function updateJob(id, patch) {
    setJobs((current) => current.map((job) => (job.id === id ? { ...job, ...patch } : job)))
  }

  function setStatus(id, status) {
    updateJob(id, { status })
  }

  function removeJob(id) {
    setJobs((current) => current.filter((job) => job.id !== id))
  }

  return { jobs, getJob, addJob, updateJob, setStatus, removeJob }
}
