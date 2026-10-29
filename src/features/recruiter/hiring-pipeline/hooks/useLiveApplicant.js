import { useLocalStorage } from '@/hooks/useLocalStorage.js'
import { recruiterJobIdOf } from '@/features/candidate/jobs/data/recruiterJobs.js'
import { useApplications } from '@/features/candidate/jobs/hooks/useApplications.js'
import { INITIAL_PROFILE, PROFILE_STORAGE_KEY } from '@/features/candidate/profile/data/profile.js'
import { initialsOf } from '@/features/candidate/profile/utils/profileText.js'
import { JOBS_STORAGE_KEY, SEED_JOBS } from '@/features/recruiter/jobs/data/jobs.js'

export const LIVE_APPLICANT_ID = 'alex-morgan'

/**
 * The demo candidate as the recruiter sees them: an applicant built from the candidate's own profile, present
 * while they have an active application to one of this company's jobs (null otherwise). Applying or withdrawing
 * in the candidate workspace therefore adds or removes them in Applications, the pipeline and Shortlists.
 */
export function useLiveApplicant() {
  const { applications } = useApplications()
  const [profile] = useLocalStorage(PROFILE_STORAGE_KEY, INITIAL_PROFILE)
  const [jobs] = useLocalStorage(JOBS_STORAGE_KEY, SEED_JOBS)

  const appliedJobs = applications
    .filter((application) => application.status !== 'withdrawn')
    .map((application) => jobs.find((job) => job.id === recruiterJobIdOf(application.jobId)))
    .filter(Boolean)
  if (!profile || appliedJobs.length === 0) return null

  const owned = new Set(profile.skills.map((skill) => skill.toLowerCase()))
  const alignedSkills = Math.max(
    ...appliedJobs.map((job) => (job.requiredSkills ?? []).filter((skill) => owned.has(skill.toLowerCase())).length),
  )
  const years = Number(profile.yearsExperience) || 0

  return {
    id: LIVE_APPLICANT_ID,
    name: profile.name,
    initials: initialsOf(profile.name),
    avatar: { bg: '#dfe8f4', fg: '#5a7b9e' },
    title: profile.headline,
    company: '',
    headline: profile.headline,
    location: profile.location,
    workMode: profile.workMode,
    experienceYears: years,
    skills: profile.skills,
    availability: profile.openToOpportunities ? 'Open to opportunities' : 'Not actively looking',
    profileStatus: `Applied for ${appliedJobs.map((job) => job.title).join(', ')}`,
    alignedSkills,
    details: {
      about: profile.about,
      roles: [{ role: profile.headline, org: 'Self-reported experience', period: `${years} ${years === 1 ? 'year' : 'years'}` }],
      education: { degree: profile.degree, period: profile.institution },
    },
  }
}
