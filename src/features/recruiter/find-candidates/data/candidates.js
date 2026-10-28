/*
 * Mock candidate profiles for Find candidates and the candidate profile (names, roles and numbers are
 * from the Figma frames). Shared with the other recruiter screens (Shortlists, Applications, Pipeline).
 *
 * id            stable slug, also the :candidateId route param
 * name          full name; initials / avatar { bg, fg } are the Figma avatar chip colours
 * title         current role, company the current employer; headline = "title · company"
 * location      "City, Country"; workMode = 'Remote' | 'Hybrid' | 'On-site'
 * experienceYears  whole years of professional experience
 * skills        every listed skill (the cards show the first three, the profile the first four)
 * availability  free text shown next to the green dot; profileStatus the note on the right of that row
 */
export const candidates = [
  {
    id: 'emma-wilson',
    name: 'Emma Wilson',
    initials: 'EW',
    avatar: { bg: '#e8e4f4', fg: '#6c5b97' },
    title: 'Senior Product Designer',
    company: 'Notion',
    headline: 'Senior Product Designer · Notion',
    location: 'San Francisco, US',
    workMode: 'Remote',
    experienceYears: 6,
    skills: ['Figma', 'Product Design', 'Design Systems', 'UX Research'],
    availability: 'Open to opportunities',
    profileStatus: 'Core profile ready',
  },
  {
    id: 'oliver-park',
    name: 'Oliver Park',
    initials: 'OP',
    avatar: { bg: '#dfe8f4', fg: '#5a7b9e' },
    title: 'Lead Product Designer',
    company: 'Vercel',
    headline: 'Lead Product Designer · Vercel',
    location: 'Berlin, Germany',
    workMode: 'Remote',
    experienceYears: 9,
    skills: ['Figma', 'Leadership', 'Design Systems', 'Product Design'],
    availability: 'Available in 1 month',
    profileStatus: 'Core profile ready',
  },
  {
    id: 'james-chen',
    name: 'James Chen',
    initials: 'JC',
    avatar: { bg: '#ddebe8', fg: '#527b72' },
    title: 'Senior Product Designer',
    company: 'Stripe',
    headline: 'Senior Product Designer · Stripe',
    location: 'New York, US',
    workMode: 'Remote',
    experienceYears: 7,
    skills: ['Figma', 'Design Systems', 'Prototyping', 'Visual Design'],
    availability: 'Available in 2 weeks',
    profileStatus: 'Core profile ready',
  },
  {
    id: 'sofia-martinez',
    name: 'Sofia Martinez',
    initials: 'SM',
    avatar: { bg: '#f3e7dc', fg: '#a77850' },
    title: 'Product Designer',
    company: 'Monzo',
    headline: 'Product Designer · Monzo',
    location: 'London, UK',
    workMode: 'Hybrid',
    experienceYears: 4,
    skills: ['Figma', 'UX Research', 'Prototyping', 'Wireframing'],
    availability: 'Open to opportunities',
    profileStatus: 'Core profile ready',
  },
  {
    id: 'daniel-kim',
    name: 'Daniel Kim',
    initials: 'DK',
    avatar: { bg: '#ece9db', fg: '#8f8553' },
    title: 'Product Designer',
    company: 'Dropbox',
    headline: 'Product Designer · Dropbox',
    location: 'San Francisco, US',
    workMode: 'On-site',
    experienceYears: 3,
    skills: ['Figma', 'Prototyping', 'Interaction Design', 'Motion Design'],
    availability: 'Open to opportunities',
    profileStatus: 'Core profile ready',
  },
  {
    id: 'aisha-patel',
    name: 'Aisha Patel',
    initials: 'AP',
    avatar: { bg: '#f3e1e9', fg: '#a76580' },
    title: 'UX Researcher',
    company: 'Spotify',
    headline: 'UX Researcher · Spotify',
    location: 'Austin, US',
    workMode: 'Remote',
    experienceYears: 5,
    skills: ['UX Research', 'User Interviews', 'Analytics', 'Survey Design'],
    availability: 'Available now',
    profileStatus: 'Core profile ready',
  },
]

export function getCandidate(id) {
  return candidates.find((candidate) => candidate.id === id)
}
