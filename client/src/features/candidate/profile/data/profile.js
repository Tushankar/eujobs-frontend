export const PROFILE_STORAGE_KEY = 'lwm.candidate.profile'

/**
 * The device-only candidate profile. My profile reads the server since Phase 3; these stay for the screens
 * that still read the mock until their phase: Find jobs (4), the recruiter applicant view (6) and
 * Data & account (12) (P3-D10).
 */
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
