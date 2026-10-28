/** Display and search helpers for the mock job data. */

export function jobPath(jobId) {
  return `/candidate/jobs/${jobId}`
}

export function formatSalary(job) {
  return `$${job.salaryMin}k – $${job.salaryMax}k`
}

export function formatPosted(hoursAgo) {
  if (hoursAgo < 24) return `${hoursAgo} hours ago`
  const days = Math.floor(hoursAgo / 24)
  return days === 1 ? '1 day ago' : `${days} days ago`
}

/** Share of a job's listed skills that appear in the candidate's profile. */
export function profileMatch(job) {
  return Math.round((job.matchingSkills / job.skills.length) * 100)
}

export function experienceTag(job) {
  return `${job.level} · ${job.experience}`
}

/** "Strong match" jobs read as green, every other label as the calmer blue. */
export function matchTone(job) {
  return job.matchLabel === 'Strong match' ? 'success' : 'info'
}

export const SORT_OPTIONS = [
  { value: 'recommended', label: 'Recommended' },
  { value: 'newest', label: 'Newest' },
  { value: 'salary', label: 'Highest salary' },
]

export const EMPTY_FILTERS = { workModes: [], levels: [], matches: [] }

/** Every query word must appear somewhere in the job's searchable text (title, company, skills, place, work model). */
export function searchJobs(jobs, { query = '', location = '', filters = EMPTY_FILTERS }) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  const place = location.trim().toLowerCase()
  return jobs.filter((job) => {
    const haystack = [job.title, job.company, job.location, job.workMode, job.level, job.industry, ...job.skills]
      .join(' ')
      .toLowerCase()
    if (!words.every((word) => haystack.includes(word))) return false
    if (place && !job.location.toLowerCase().includes(place)) return false
    if (filters.workModes.length && !filters.workModes.includes(job.workMode)) return false
    if (filters.levels.length && !filters.levels.includes(job.level)) return false
    if (filters.matches.length && !filters.matches.includes(job.matchLabel)) return false
    return true
  })
}

export function sortJobs(jobs, sort) {
  if (sort === 'newest') return [...jobs].sort((a, b) => a.postedHoursAgo - b.postedHoursAgo)
  if (sort === 'salary') return [...jobs].sort((a, b) => b.salaryMax - a.salaryMax)
  return jobs
}
