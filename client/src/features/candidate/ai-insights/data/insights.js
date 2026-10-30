/*
 * Mock evidence for the AI insights group. Everything here is "provided locally":
 * the profile fields the candidate has reviewed, the demo opportunities they are
 * compared with, and the guidance copy that goes with a missing skill.
 */

export const PROFILE = {
  name: 'Alex Morgan',
  initials: 'AM',
  title: 'Product Designer',
  location: 'San Francisco, US',
  skills: ['Product Design', 'Figma', 'Design Systems', 'UX Research', 'Prototyping'],
  yearsReported: 5,
  workPreference: 'Remote',
}

/** Total demo opportunities the home page counts against ("Among the current demo opportunities"). */
export const DEMO_OPPORTUNITY_COUNT = 9
export const ROLES_WITH_ALIGNED_SKILLS = 9

/** How many of the demo opportunities list each skill ("Listed skills appearing in current opportunities"). */
export const SKILL_DEMAND = {
  'Product Design': 3,
  Figma: 7,
  'Design Systems': 3,
  'UX Research': 3,
  Prototyping: 4,
  'Interaction Design': 2,
  Fintech: 1,
  'Accessibility testing': 2,
}

/** Logo marks are drawn from the Figma colours; `mark` selects a special shape. */
export const ROLES = [
  {
    id: 'linear',
    jobId: 'linear-senior-product-designer',
    title: 'Senior Product Designer',
    company: 'Linear',
    workMode: 'Remote',
    salary: '$140k – $180k',
    location: 'San Francisco, US',
    requiredSkills: ['Product Design', 'Figma', 'Design Systems'],
    minYears: 5,
    logo: { glyph: 'half-circle', background: '#6665df', color: '#ffffff', pickerBackground: 'var(--primary)' },
  },
  {
    id: 'figma',
    jobId: 'figma-product-designer',
    title: 'Product Designer',
    company: 'Figma',
    workMode: 'Remote',
    salary: '$130k – $170k',
    location: 'San Francisco, US',
    requiredSkills: ['Product Design', 'Figma', 'Prototyping'],
    minYears: 4,
    logo: { glyph: 'F', background: '#f4ece7', color: '#e67050' },
  },
  {
    id: 'acme',
    jobId: 'acme-senior-product-designer',
    title: 'Senior Product Designer',
    company: 'Acme Studio',
    workMode: 'Remote',
    salary: '$135k – $175k',
    location: 'San Francisco, US',
    requiredSkills: ['Product Design', 'UX Research', 'Prototyping'],
    minYears: 5,
    logo: { glyph: 'A', background: '#eae5f5', color: '#7662ad' },
  },
  {
    id: 'notion',
    jobId: 'notion-product-designer-growth',
    title: 'Product Designer, Growth',
    company: 'Notion',
    workMode: 'Hybrid',
    salary: '$125k – $165k',
    location: 'San Francisco, US',
    requiredSkills: ['Product Design', 'Prototyping', 'Design Systems', 'Accessibility testing'],
    minYears: 4,
    logo: { glyph: 'N', background: '#ffffff', color: '#171717', border: '#171717', serif: true },
  },
  {
    id: 'stripe',
    jobId: 'stripe-senior-ux-designer',
    title: 'Senior UX Designer',
    company: 'Stripe',
    workMode: 'Remote',
    salary: '$130k – $175k',
    location: 'San Francisco, US',
    requiredSkills: ['UX Research', 'Interaction Design', 'Fintech'],
    minYears: 5,
    logo: { glyph: 'S', background: 'var(--accent)', color: 'var(--primary)' },
  },
]

/** "A practical way to build evidence" copy per skill that a role may list but a profile may not. */
export const SKILL_GUIDANCE = {
  'Interaction Design': 'Prototype one end-to-end flow. Include keyboard interaction, edge cases, empty states, and helpful errors.',
  Fintech: 'Explore a payments or banking journey. Map the trust, clarity, and accessibility challenges in a small case study.',
  'Accessibility testing': 'Document one accessibility check you ran, such as keyboard-only and screen reader passes, and what you changed afterwards.',
}

export const DEFAULT_GUIDANCE = 'Add one concrete example, such as a short case study, that shows how you have used this skill.'

/** "Your next useful improvements" cards on the Improve profile page. */
export const IMPROVEMENTS = [
  {
    id: 'portfolio',
    title: 'Let your work speak for itself',
    description: 'Add a portfolio or case study that shows your process, contribution, and impact.',
    status: 'worth-adding',
    icon: 'external-link',
    action: { label: 'Add portfolio', to: '/candidate/profile', primary: true },
  },
  {
    id: 'summary',
    title: 'Put your experience in your own words',
    description: 'A clear summary gives recruiters context beyond a list of skills. Keep every claim grounded.',
    status: 'provided',
    icon: 'file-text',
    action: { label: 'Refine summary', to: '/candidate/profile' },
  },
  {
    id: 'skills',
    title: 'Make relevant skills visible',
    description: 'Review skill names and add only the ones that reflect your actual experience.',
    status: 'provided',
    icon: 'layers',
    action: { label: 'Review skills', to: '/candidate/profile' },
  },
  {
    id: 'experience',
    title: 'Give your career the right context',
    description: 'Confirm your professional title and relevant experience. Years alone don’t determine fit.',
    status: 'provided',
    icon: 'briefcase',
    action: { label: 'Review experience', to: '/candidate/profile' },
  },
  {
    id: 'resume',
    title: 'Keep your resume current',
    description: 'Upload a recent PDF or DOCX, then review every extracted field before confirming.',
    status: 'provided',
    icon: 'upload',
    action: { label: 'Review resume', to: '/candidate/cv-versions' },
  },
]

export const PROFILE_COMPLETENESS = { percent: 85, provided: 4, total: 5 }
