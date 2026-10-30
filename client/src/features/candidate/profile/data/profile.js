export const PROFILE_STORAGE_KEY = 'lwm.candidate.profile'

/** Candidate profile as shown in the Figma "My profile" frame. */
export const INITIAL_PROFILE = {
  name: 'Alex Morgan',
  headline: 'Product Designer',
  location: 'San Francisco, US',
  openToOpportunities: true,
  about:
    'Product designer turning complex problems into thoughtful, human-centered experiences. Passionate about design systems and building products people love.',
  yearsExperience: 5,
  skills: ['Product Design', 'Figma', 'Design Systems', 'UX Research', 'Prototyping'],
  degree: 'BFA, Interaction Design',
  institution: 'California College of the Arts',
  workMode: 'Remote',
  salaryMin: 120,
}

/** Blank form values for a profile that has been deleted from this device. */
export const BLANK_PROFILE = {
  ...INITIAL_PROFILE,
  headline: '',
  location: '',
  openToOpportunities: true,
  about: '',
  yearsExperience: '',
  skills: [],
  degree: '',
  institution: '',
  salaryMin: '',
}

export const WORK_MODES = ['Remote', 'Hybrid', 'On-site']
