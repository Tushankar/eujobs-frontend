/*
 * Recruiter job postings (mock data). Shared by Jobs, Create a job, Job details and the Overview.
 * User changes are persisted to localStorage by useJobs under JOBS_STORAGE_KEY.
 *
 * status: 'published' | 'paused' | 'draft' | 'closed'
 * workPreference: 'Remote' | 'Hybrid' | 'On-site'
 *
 * Optional detail fields (written by Create a job, read by Job details; every reader copes with them
 * being absent): company, description (the brief), responsibilities (string[]), requiredSkills
 * (string[]), preferredSkills (string[]), level ('Junior' | 'Mid-level' | 'Senior' | 'Lead'),
 * experienceYears (number, minimum), salaryMin / salaryMax (annual USD), applications (count of local
 * applications; `relevant` is the count of profiles with relevant listed skills).
 */
export const JOBS_STORAGE_KEY = 'lwm.recruiter.jobs'

export const JOB_STATUSES = {
  published: { label: 'Published' },
  paused: { label: 'Paused' },
  draft: { label: 'Draft' },
  closed: { label: 'Closed' },
}

export const WORK_PREFERENCES = ['Remote', 'Hybrid', 'On-site']
export const EMPLOYMENT_TYPES = ['Full-time', 'Part-time', 'Contract', 'Internship']

export const SEED_JOBS = [
  {
    id: 'senior-product-designer',
    title: 'Senior Product Designer',
    location: 'San Francisco, US',
    workPreference: 'Remote',
    employmentType: 'Full-time',
    relevant: 5,
    status: 'published',
    createdAt: '2026-10-02T09:00:00.000Z',
    company: 'Acme Studio',
    description:
      'Help us build the next generation of tools for ambitious product teams. You’ll shape thoughtful, beautifully crafted experiences that make complex work feel simple.',
    responsibilities: [],
    requiredSkills: ['Product Design', 'Figma', 'Design Systems'],
    preferredSkills: [],
    level: 'Senior',
    experienceYears: 5,
    salaryMin: 140000,
    salaryMax: 180000,
    applications: 0,
  },
  {
    id: 'product-designer-growth',
    title: 'Product Designer, Growth',
    location: 'New York, US',
    workPreference: 'Hybrid',
    employmentType: 'Full-time',
    relevant: 6,
    status: 'published',
    createdAt: '2026-10-05T09:00:00.000Z',
    company: 'Acme Studio',
    description:
      'Own the experience people have in their first weeks with our product. You will partner with product, engineering and data to design, test and ship onboarding and activation flows that measurably improve retention.',
    responsibilities: [
      'Design and prototype onboarding, activation and referral experiences end to end',
      'Plan and run experiments with product managers and analysts, then act on the results',
      'Keep growth surfaces consistent with the design system',
      'Present rationale and results to the wider product team',
    ],
    requiredSkills: ['Product Design', 'Figma', 'Experimentation', 'Data Analysis'],
    preferredSkills: ['Prototyping', 'SQL'],
    level: 'Mid-level',
    experienceYears: 3,
    salaryMin: 120000,
    salaryMax: 150000,
    applications: 2,
  },
  {
    id: 'senior-ux-designer',
    title: 'Senior UX Designer',
    location: 'London, UK',
    workPreference: 'Remote',
    employmentType: 'Full-time',
    relevant: 5,
    status: 'published',
    createdAt: '2026-10-09T09:00:00.000Z',
    company: 'Acme Studio',
    description:
      'Lead research-informed UX work for our core collaboration platform. You will shape information architecture and interaction patterns used by thousands of teams every day, and mentor designers across the group.',
    responsibilities: [
      'Lead discovery and usability research and turn findings into clear design direction',
      'Define interaction patterns and information architecture for core product areas',
      'Mentor designers and raise the quality bar through critique',
    ],
    requiredSkills: ['UX Design', 'User Research', 'Interaction Design', 'Figma'],
    preferredSkills: ['Accessibility', 'Design Systems'],
    level: 'Senior',
    experienceYears: 6,
    salaryMin: 130000,
    salaryMax: 165000,
    applications: 1,
  },
]
