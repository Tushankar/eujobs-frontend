/** Evidence signals an admin can switch on or off in a matching policy. */
export const POLICY_SIGNALS = [
  {
    id: 'skills',
    label: 'Relevant skills',
    description: 'Compare candidate-provided skills with the role’s mandatory and preferred requirements.',
  },
  {
    id: 'experience',
    label: 'Relevant experience',
    description: 'Include career context and role-specific evidence. Years alone never determine a match.',
  },
  {
    id: 'location',
    label: 'Location & work preferences',
    description: 'Respect stated remote, hybrid, on-site, and location preferences.',
  },
]

export const HUMAN_REVIEW_SIGNAL = {
  label: 'Require human review',
  description: 'Always on. AI cannot autonomously select, reject, contact, or hire a candidate.',
}

export const DEFAULT_POLICY = {
  id: 'policy-default',
  name: 'Default evidence policy',
  description: 'Balanced evidence review for skills, experience, and work preferences.',
  updatedAt: '2026-09-30T08:05:00',
  signals: { skills: true, experience: true, location: true },
}

/** Matching quality rows recruiters see for the Senior Product Designer role. */
export const OVERSIGHT_CANDIDATES = [
  { id: 'alex', name: 'Alex Morgan', role: 'Product Designer', initials: 'AM', percent: 100, tone: 'blue' },
  { id: 'emma', name: 'Emma Wilson', role: 'Senior Product Designer', initials: 'EW', percent: 100, tone: 'lilac' },
  { id: 'oliver', name: 'Oliver Park', role: 'Lead Product Designer', initials: 'OP', percent: 100, tone: 'sky' },
  { id: 'james', name: 'James Chen', role: 'Senior Product Designer', initials: 'JC', percent: 77, tone: 'mint' },
]

export const MATCH_EVIDENCE = {
  summary: '3 relevant skills · 6 years of experience · Remote',
  skills: ['Figma', 'Design Systems', 'Product Design'],
  experience: '6 years of experience reported in the profile. Verify role-specific experience during review.',
  gap: 'Enterprise SaaS experience not confirmed',
  disclaimer: 'Based on profile evidence and stated preferences, not a hiring decision. You remain in control.',
}

/** Local, template-based rewrite of a policy description. Nothing is sent anywhere. */
export function suggestDescription(name, description) {
  const intro = description.trim().replace(/\.*$/, '')
  return `${intro}. Applies to ${name.trim()}: skills and role-relevant experience are compared as evidence, potential gaps are shown alongside strengths, and a person reviews every recommendation before any decision.`
}
