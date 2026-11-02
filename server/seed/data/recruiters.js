/*
 * Companies, recruiters and jobs for seed:demo (§3.20, M-208, M-145, OQ-4, U42). Acme Studio is Sarah's company
 * from the recruiter mocks (company.js, jobs.js); every other company of the candidate job mocks (jobs.js) gets
 * one approved recruiter on example.com (OD9). Jobs keep their mock work mode: remote jobs list in the Remote
 * view, the others move to U42 cities. USD salaries use OQ-4 (1 USD = 0.75 GBP = 0.87 EUR = 3.75 PLN = 9.6 SEK),
 * rounded to 1,000. Websites are on example.com so no real domain is linked.
 */
const USD = { GBP: 0.75, EUR: 0.87, PLN: 3.75, SEK: 9.6 }
const CURRENCY = { london: 'GBP', stockholm: 'SEK', remote: 'EUR', amsterdam: 'EUR', paris: 'EUR' }

/** Thousands of USD a year → the city's currency, rounded to 1,000 (OQ-4). */
export function salaryIn(city, [minK, maxK]) {
  const currency = CURRENCY[city]
  const convert = (thousands) => Math.round((thousands * 1000 * USD[currency]) / 1000) * 1000
  return { min: convert(minK), max: convert(maxK), currency, period: 'year' }
}

// The job mocks have no brief or responsibilities; the shared role copy of the job details mock fills them.
const ROLE_ABOUT =
  'Help us build the next generation of tools for ambitious product teams. You’ll shape thoughtful, beautifully crafted experiences that make complex work feel simple.'
const ROLE_IMPACT = [
  'Own the end-to-end experience for a key product area, from discovery to launch.',
  'Partner closely with engineering, product, and research to turn insights into thoughtful solutions.',
  'Build and evolve reusable systems that keep quality consistent as we grow.',
  'Bring a clear point of view and make space for different perspectives.',
]

/** `city` is the company city; `recruiter` the seeded hiring contact (tag = demo alias, else email). */
export const COMPANIES = [
  {
    key: 'acme',
    recruiter: { tag: 'sarah' },
    name: 'Acme Studio',
    industry: 'Enterprise SaaS',
    size: '51_200',
    city: 'london',
    website: 'https://acme.example',
    description:
      'We’re a small, ambitious team building thoughtful software for modern businesses. We believe great work happens when talented people have the space to make an impact.',
    approvedDaysAgo: 40,
  },
  { key: 'linear', recruiter: { fullName: 'Maya Brooks', email: 'maya.brooks@example.com' }, name: 'Linear', industry: 'SaaS', size: '201_500', city: 'dublin', description: 'A product-led team helping people and businesses do their best work. Building with care, ambition, and a long-term perspective.' },
  { key: 'notion', recruiter: { fullName: 'Lucas Meyer', email: 'lucas.meyer@example.com' }, name: 'Notion', industry: 'Productivity software', size: '501_1000', city: 'amsterdam', description: 'A connected workspace for notes, docs and projects. The team designs flexible tools that people shape to fit the way they work.' },
  { key: 'stripe', recruiter: { fullName: 'Nora Kelly', email: 'nora.kelly@example.com' }, name: 'Stripe', industry: 'Fintech', size: '1000_plus', city: 'dublin', description: 'Payments and financial tooling for internet businesses of every size, designed to be dependable, fast and easy to adopt.' },
  { key: 'figma', recruiter: { fullName: 'Tom Becker', email: 'tom.becker@example.com' }, name: 'Figma', industry: 'Design software', size: '1000_plus', city: 'london', description: 'A collaborative design platform for teams building digital products, shaped closely by the community that uses it.' },
  { key: 'vercel', recruiter: { fullName: 'Lena Fischer', email: 'lena.fischer@example.com' }, name: 'Vercel', industry: 'Developer tools', size: '201_500', city: 'berlin', description: 'A frontend cloud for developers, built around speed, clear workflows and a high bar for craft.' },
  { key: 'spotify', recruiter: { fullName: 'Erik Lund', email: 'erik.lund@example.com' }, name: 'Spotify', industry: 'Media & entertainment', size: '1000_plus', city: 'stockholm', description: 'An audio platform that connects creators and listeners, backed by research-led product teams.' },
  { key: 'shopify', recruiter: { fullName: 'Inês Costa', email: 'ines.costa@example.com' }, name: 'Shopify', industry: 'E-commerce', size: '1000_plus', city: 'lisbon', description: 'Commerce tools for millions of merchants, with design teams that own quality end to end.' },
  { key: 'canva', recruiter: { fullName: 'Camille Martin', email: 'camille.martin@example.com' }, name: 'Canva', industry: 'Design software', size: '1000_plus', city: 'paris', description: 'A visual communication platform that makes design approachable for everyone.' },
  { key: 'monzo', recruiter: { fullName: 'Ravi Shah', email: 'ravi.shah@example.com' }, name: 'Monzo', industry: 'Fintech', size: '1000_plus', city: 'london', description: 'A digital bank built around clear, human product design and fast iteration.' },
]

const mockJob = ({ company, title, tagline, city, workPreference, level, years, usd, skills, hoursAgo }) => ({
  company,
  title,
  employmentType: 'full_time',
  brief: `${tagline} ${ROLE_ABOUT}`,
  responsibilities: ROLE_IMPACT,
  requiredSkills: skills,
  preferredSkills: [],
  level,
  experienceYears: years,
  workPreference,
  city,
  salary: salaryIn(city, usd),
  hoursAgo,
})

/** The nine candidate-mock jobs of other companies, plus the three Acme jobs of the recruiter mock. */
export const JOBS = [
  mockJob({ company: 'linear', title: 'Senior Product Designer', tagline: 'Build something meaningful, with people who care about the details.', city: 'remote', workPreference: 'remote', level: 'senior', years: 5, usd: [140, 180], skills: ['Product Design', 'Figma', 'Design Systems'], hoursAgo: 2 }),
  mockJob({ company: 'notion', title: 'Product Designer, Growth', tagline: 'Shape how millions of people discover and adopt better ways to work.', city: 'amsterdam', workPreference: 'hybrid', level: 'mid', years: 3, usd: [120, 160], skills: ['UX Research', 'Prototyping', 'Figma'], hoursAgo: 5 }),
  mockJob({ company: 'stripe', title: 'Senior UX Designer', tagline: 'Make financial infrastructure feel simple for the people who build on it.', city: 'remote', workPreference: 'remote', level: 'senior', years: 5, usd: [130, 175], skills: ['Interaction Design', 'Figma', 'Fintech'], hoursAgo: 24 }),
  mockJob({ company: 'figma', title: 'Product Designer', tagline: 'Design the tools that designers and developers use every day.', city: 'remote', workPreference: 'remote', level: 'mid', years: 3, usd: [135, 170], skills: ['Figma', 'Design Systems', 'Prototyping'], hoursAgo: 48 }),
  mockJob({ company: 'vercel', title: 'Lead Product Designer', tagline: 'Lead design for the platform developers use to ship the web.', city: 'remote', workPreference: 'remote', level: 'lead', years: 7, usd: [160, 200], skills: ['Product Design', 'Leadership', 'Developer Tools'], hoursAgo: 72 }),
  mockJob({ company: 'spotify', title: 'UX Researcher', tagline: 'Turn listening behaviour into insight that shapes what people hear next.', city: 'stockholm', workPreference: 'hybrid', level: 'mid', years: 3, usd: [100, 135], skills: ['UX Research', 'User Interviews', 'Analytics'], hoursAgo: 72 }),
  mockJob({ company: 'shopify', title: 'Design Systems Designer', tagline: 'Grow the component library that helps merchants and teams move faster.', city: 'remote', workPreference: 'remote', level: 'mid', years: 3, usd: [125, 155], skills: ['Design Systems', 'Figma', 'Accessibility'], hoursAgo: 96 }),
  mockJob({ company: 'canva', title: 'Senior Product Designer', tagline: 'Help people everywhere create and share work they are proud of.', city: 'paris', workPreference: 'hybrid', level: 'senior', years: 5, usd: [130, 165], skills: ['Product Design', 'Prototyping', 'Brand Design'], hoursAgo: 120 }),
  mockJob({ company: 'monzo', title: 'Product Designer, Fintech', tagline: 'Make everyday money simple for millions of customers.', city: 'london', workPreference: 'on_site', level: 'mid', years: 3, usd: [110, 140], skills: ['Fintech', 'Figma', 'Interaction Design'], hoursAgo: 144 }),
  {
    company: 'acme',
    title: 'Senior Product Designer',
    employmentType: 'full_time',
    brief: 'Help us build the next generation of tools for ambitious product teams. You’ll shape thoughtful, beautifully crafted experiences that make complex work feel simple.',
    responsibilities: [],
    requiredSkills: ['Product Design', 'Figma', 'Design Systems'],
    preferredSkills: [],
    level: 'senior',
    experienceYears: 5,
    workPreference: 'remote',
    city: 'remote',
    salary: salaryIn('remote', [140, 180]),
    hoursAgo: 28 * 24,
  },
  {
    company: 'acme',
    title: 'Product Designer, Growth',
    employmentType: 'full_time',
    brief: 'Own the experience people have in their first weeks with our product. You will partner with product, engineering and data to design, test and ship onboarding and activation flows that measurably improve retention.',
    responsibilities: [
      'Design and prototype onboarding, activation and referral experiences end to end',
      'Plan and run experiments with product managers and analysts, then act on the results',
      'Keep growth surfaces consistent with the design system',
      'Present rationale and results to the wider product team',
    ],
    requiredSkills: ['Product Design', 'Figma', 'Experimentation', 'Data Analysis'],
    preferredSkills: ['Prototyping', 'SQL'],
    level: 'mid',
    experienceYears: 3,
    workPreference: 'hybrid',
    city: 'london',
    salary: salaryIn('london', [120, 150]),
    hoursAgo: 25 * 24,
  },
  {
    company: 'acme',
    title: 'Senior UX Designer',
    employmentType: 'full_time',
    brief: 'Lead research-informed UX work for our core collaboration platform. You will shape information architecture and interaction patterns used by thousands of teams every day, and mentor designers across the group.',
    responsibilities: [
      'Lead discovery and usability research and turn findings into clear design direction',
      'Define interaction patterns and information architecture for core product areas',
      'Mentor designers and raise the quality bar through critique',
    ],
    requiredSkills: ['UX Design', 'User Research', 'Interaction Design', 'Figma'],
    preferredSkills: ['Accessibility', 'Design Systems'],
    level: 'senior',
    experienceYears: 6,
    workPreference: 'remote',
    city: 'remote',
    salary: salaryIn('remote', [130, 165]),
    hoursAgo: 21 * 24,
  },
]

/** OQ-4.1: the recruiter applicant James Chen, pending review with a Dublin company (P1-Q3). */
export const APPLICANT_COMPANY = {
  name: 'Chen Talent Partners Ltd',
  industry: 'Recruitment services',
  size: '1_10',
  city: 'dublin',
  website: 'https://chentalent.example.com',
  businessEmail: 'hello@chentalent.example.com',
  businessAddress: '1 Example Street, Dublin 2',
  registrationDetails: 'Company number 000000 (sample)',
  phone: '+442079460201',
  submittedDaysAgo: 2,
}

/* Recruiter-mock state (useShortlist, Find candidates frame): Acme's shortlist; Alex's saved jobs (applications.js). */
export const ACME_SHORTLIST = ['Oliver Park', 'James Chen']
export const ALEX_SAVED_JOBS = [
  { company: 'stripe', title: 'Senior UX Designer' },
  { company: 'spotify', title: 'UX Researcher' },
]

/** The candidate Overview mock: 18 profile views in the last 30 days, 16 in the 30 before (↑ 12%). */
export const PROFILE_VIEWS = { last30: 18, previous30: 16 }
