/* Mock courses for Admin > Courses. Titles, levels, prices and dates mirror the two Figma frames. */

export const COURSE_LEVELS = ['Foundation', 'Intermediate', 'Advanced']

/** Audience tabs: courses shown to candidates or to recruiters in their own Learning workspace. */
export const AUDIENCES = {
  candidate: { label: 'Candidate courses', visibleIn: 'candidate learning' },
  recruiter: { label: 'Recruiter courses', visibleIn: 'recruiter learning' },
}

function course(audience, id, title, category, lessons, level, price, updatedAt) {
  return { id, audience, title, category, lessons, level, price, status: 'published', updatedAt, enrolled: 0, purchased: 0, mediaName: '' }
}

export const INITIAL_COURSES = [
  course('candidate', 'interaction-design-foundations', 'Interaction design foundations', 'Interaction Design', 4, 'Foundation', 0, '2026-09-30T09:00:00.000Z'),
  course('candidate', 'interaction-systems-in-practice', 'Interaction systems in practice', 'Interaction Design', 4, 'Intermediate', 39, '2026-09-30T09:00:00.000Z'),
  course('candidate', 'designing-trusted-fintech-journeys', 'Designing trusted fintech journeys', 'Fintech', 4, 'Foundation', 0, '2026-09-30T09:00:00.000Z'),
  course('candidate', 'design-leadership-in-practice', 'Design leadership in practice', 'Leadership', 4, 'Intermediate', 49, '2026-09-30T09:00:00.000Z'),
  course('candidate', 'designing-for-developer-workflows', 'Designing for developer workflows', 'Developer Tools', 4, 'Advanced', 59, '2026-09-30T09:00:00.000Z'),
  course('candidate', 'evidence-led-user-interviews', 'Evidence-led user interviews', 'User Interviews', 4, 'Foundation', 0, '2026-09-30T09:00:00.000Z'),
  course('recruiter', 'hiring-technology-product-talent', 'Hiring Technology & Product Talent', 'SaaS & Technology', 5, 'Intermediate', 0, '2026-10-27T15:26:39.000Z'),
  course('recruiter', 'fair-inclusive-responsible-hiring', 'Fair, Inclusive & Responsible Hiring', 'Ethical Hiring', 5, 'Foundation', 0, '2026-10-01T09:00:00.000Z'),
  course('recruiter', 'structured-interviewing-better-evidence', 'Structured Interviewing & Better Evidence', 'Interviewing', 5, 'Intermediate', 0, '2026-10-01T09:00:00.000Z'),
  course('recruiter', 'talent-strategy-workforce-planning', 'Talent Strategy & Workforce Planning', 'Talent Strategy', 5, 'Advanced', 0, '2026-10-01T09:00:00.000Z'),
  course('recruiter', 'employer-brand-candidate-experience', 'Employer Brand & Candidate Experience', 'Employer Brand', 5, 'Foundation', 0, '2026-10-01T09:00:00.000Z'),
  course('recruiter', 'recruiting-leadership-team-coaching', 'Recruiting Leadership & Team Coaching', 'People Leadership', 5, 'Advanced', 0, '2026-10-01T09:00:00.000Z'),
]

export const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'published', label: 'Published' },
  { value: 'draft', label: 'Draft' },
]
