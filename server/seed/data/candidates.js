/*
 * Seeded candidates (§3.20, OQ-4, P3-D11, P3-D12). Alex is the candidate mock (profile.js, incomplete by
 * design); the other six are the recruiter mocks (candidates.js, candidateDetails.js) moved to U42 cities.
 * `tag` makes a demo plus-alias; the others use example.com addresses (never mailed, OD9). Periods are the
 * mock years: education runs September to June, roles start in January. The mocks name no institutions,
 * so the seed names one per person. Phones are Ofcom's fictional London range.
 */
const portfolio = (slug) => `https://${slug}.example.com`

export const CANDIDATES = [
  {
    tag: 'alex',
    fullName: 'Alex Morgan',
    city: 'london',
    complete: false,
    headline: 'Product Designer',
    about:
      'Product designer turning complex problems into thoughtful, human-centered experiences. Passionate about design systems and building products people love.',
    yearsExperience: 5,
    skills: ['Product Design', 'Figma', 'Design Systems', 'UX Research', 'Prototyping'],
    workPreference: 'remote',
    availability: 'open_to_opportunities',
    // $120k a year at OQ-4's 1 USD = 0.75 GBP
    salaryMin: { amount: 90_000, currency: 'GBP', period: 'year' },
    workHistory: [],
    education: [{ institution: 'California College of the Arts', degree: 'BFA, Interaction Design', start: '2014-09', end: '2018-06' }],
    cvName: 'Alex_Morgan_Resume.pdf',
  },
  {
    tag: 'emma',
    fullName: 'Emma Wilson',
    city: 'london',
    complete: true,
    avatar: { bg: '#e8e4f4', fg: '#6c5b97' },
    headline: 'Senior Product Designer · Notion',
    about:
      'Emma is a senior product designer with 6 years of experience creating thoughtful digital products. Their recent work at Notion includes cross-functional collaboration and a focus on figma and product design.',
    yearsExperience: 6,
    skills: ['Figma', 'Product Design', 'Design Systems', 'UX Research'],
    workPreference: 'remote',
    availability: 'open_to_opportunities',
    workHistory: [
      { title: 'Senior Product Designer', employer: 'Notion', start: '2022-01', current: true },
      { title: 'Product Designer', employer: 'Independent studio', start: '2019-01', end: '2022-01' },
    ],
    education: [{ institution: 'University of the Arts London', degree: 'Bachelor of Design', start: '2015-09', end: '2019-06' }],
    languages: [{ code: 'en', level: 'native' }],
    rightToWork: [{ region: 'uk', status: 'citizen_settled' }],
    links: { portfolio: portfolio('emma-wilson') },
    phone: '+442079460101',
  },
  {
    email: 'oliver.park@example.com',
    fullName: 'Oliver Park',
    city: 'berlin',
    complete: true,
    avatar: { bg: '#dfe8f4', fg: '#5a7b9e' },
    headline: 'Lead Product Designer · Vercel',
    about:
      'Oliver is a lead product designer with 9 years of experience creating thoughtful digital products. Their recent work at Vercel includes cross-functional collaboration and a focus on figma and leadership.',
    yearsExperience: 9,
    skills: ['Figma', 'Leadership', 'Design Systems', 'Product Design'],
    workPreference: 'remote',
    availability: 'within_1_month',
    workHistory: [
      { title: 'Lead Product Designer', employer: 'Vercel', start: '2021-01', current: true },
      { title: 'Senior Product Designer', employer: 'Design agency', start: '2017-01', end: '2021-01' },
    ],
    education: [{ institution: 'Berlin University of the Arts', degree: 'Master of Design', start: '2013-09', end: '2015-06' }],
    languages: [
      { code: 'de', level: 'native' },
      { code: 'en', level: 'c1' },
    ],
    rightToWork: [{ region: 'eu', status: 'citizen_settled' }],
    links: { portfolio: portfolio('oliver-park') },
    phone: '+442079460102',
  },
  {
    email: 'james.chen@example.com',
    fullName: 'James Chen',
    city: 'amsterdam',
    complete: true,
    avatar: { bg: '#ddebe8', fg: '#527b72' },
    headline: 'Senior Product Designer · Stripe',
    about:
      'James is a senior product designer with 7 years of experience creating thoughtful digital products. Their recent work at Stripe includes cross-functional collaboration and a focus on figma and design systems.',
    yearsExperience: 7,
    skills: ['Figma', 'Design Systems', 'Prototyping', 'Visual Design'],
    workPreference: 'remote',
    availability: 'within_2_weeks',
    workHistory: [
      { title: 'Senior Product Designer', employer: 'Stripe', start: '2022-01', current: true },
      { title: 'Product Designer', employer: 'Freelance', start: '2019-01', end: '2022-01' },
    ],
    education: [{ institution: 'Parsons School of Design', degree: 'Bachelor of Fine Arts', start: '2014-09', end: '2018-06' }],
    languages: [
      { code: 'en', level: 'native' },
      { code: 'nl', level: 'a2' },
    ],
    rightToWork: [{ region: 'eu', status: 'citizen_settled' }],
    links: { portfolio: portfolio('james-chen') },
    phone: '+442079460103',
  },
  {
    email: 'sofia.martinez@example.com',
    fullName: 'Sofia Martinez',
    city: 'london',
    complete: true,
    avatar: { bg: '#f3e7dc', fg: '#a77850' },
    headline: 'Product Designer · Monzo',
    about:
      'Sofia is a product designer with 4 years of experience creating thoughtful digital products. Their recent work at Monzo includes cross-functional collaboration and a focus on figma and ux research.',
    yearsExperience: 4,
    skills: ['Figma', 'UX Research', 'Prototyping', 'Wireframing'],
    workPreference: 'hybrid',
    availability: 'open_to_opportunities',
    workHistory: [
      { title: 'Product Designer', employer: 'Monzo', start: '2023-01', current: true },
      { title: 'Junior Designer', employer: 'Digital studio', start: '2022-01', end: '2023-01' },
    ],
    education: [{ institution: 'Royal College of Art', degree: 'Bachelor of Arts in Design', start: '2018-09', end: '2022-06' }],
    languages: [
      { code: 'en', level: 'native' },
      { code: 'es', level: 'c1' },
    ],
    rightToWork: [
      { region: 'uk', status: 'citizen_settled' },
      { region: 'eu', status: 'citizen_settled' },
    ],
    links: { portfolio: portfolio('sofia-martinez') },
    phone: '+442079460104',
  },
  {
    email: 'daniel.kim@example.com',
    fullName: 'Daniel Kim',
    city: 'paris',
    complete: true,
    avatar: { bg: '#ece9db', fg: '#8f8553' },
    headline: 'Product Designer · Dropbox',
    about:
      'Daniel is a product designer with 3 years of experience creating thoughtful digital products. Their recent work at Dropbox includes cross-functional collaboration and a focus on figma and prototyping.',
    yearsExperience: 3,
    skills: ['Figma', 'Prototyping', 'Interaction Design', 'Motion Design'],
    workPreference: 'on_site',
    availability: 'open_to_opportunities',
    workHistory: [
      { title: 'Product Designer', employer: 'Dropbox', start: '2024-01', current: true },
      { title: 'Associate Designer', employer: 'Early-stage startup', start: '2023-01', end: '2024-01' },
    ],
    education: [{ institution: 'ArtCenter College of Design', degree: 'Bachelor of Design', start: '2019-09', end: '2023-06' }],
    languages: [
      { code: 'en', level: 'native' },
      { code: 'fr', level: 'b2' },
    ],
    rightToWork: [{ region: 'eu', status: 'citizen_settled' }],
    links: { portfolio: portfolio('daniel-kim') },
    phone: '+442079460105',
  },
  {
    email: 'aisha.patel@example.com',
    fullName: 'Aisha Patel',
    city: 'stockholm',
    complete: true,
    avatar: { bg: '#f3e1e9', fg: '#a76580' },
    headline: 'UX Researcher · Spotify',
    about:
      'Aisha is a UX researcher with 5 years of experience creating thoughtful digital products. Their recent work at Spotify includes cross-functional collaboration and a focus on ux research and user interviews.',
    yearsExperience: 5,
    skills: ['UX Research', 'User Interviews', 'Analytics', 'Survey Design'],
    workPreference: 'remote',
    availability: 'available_now',
    workHistory: [
      { title: 'UX Researcher', employer: 'Spotify', start: '2022-01', current: true },
      { title: 'Research Associate', employer: 'University research lab', start: '2020-01', end: '2022-01' },
    ],
    education: [
      { institution: 'University College London', degree: 'Master of Science in Human-Computer Interaction', start: '2018-09', end: '2020-06' },
    ],
    languages: [
      { code: 'en', level: 'native' },
      { code: 'sv', level: 'b1' },
    ],
    rightToWork: [{ region: 'eu', status: 'citizen_settled' }],
    links: { portfolio: portfolio('aisha-patel') },
    phone: '+442079460106',
  },
]

/** IANA time zone of each seed city (U12). */
export const CITY_TIME_ZONES = {
  london: 'Europe/London',
  berlin: 'Europe/Berlin',
  amsterdam: 'Europe/Amsterdam',
  paris: 'Europe/Paris',
  stockholm: 'Europe/Stockholm',
}
