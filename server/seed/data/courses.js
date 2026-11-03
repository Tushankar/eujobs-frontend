import { CANDIDATE_COURSE_CONTENT } from './courseContent/candidate.js'
import { RECRUITER_COURSE_CONTENT } from './courseContent/recruiter.js'

/*
 * The 12 seed courses (M-207: the learner catalogue values win; M-209, U42). Copy comes from the candidate and
 * recruiter learning mocks; lessons and quizzes from ./courseContent. Skill tags are the course category or
 * stream (M-114); recruiter pipeline categories are P8-Q2. Covers are client assets (§6 Phase 8, task 4).
 */

// OD1, verbatim: the course price per currency, keyed by the GBP price.
export const COURSE_PRICES = {
  19: { GBP: 19, EUR: 22, PLN: 95, SEK: 249, DKK: 169, CZK: 549, HUF: 8490, RON: 115 },
  29: { GBP: 29, EUR: 34, PLN: 145, SEK: 369, DKK: 249, CZK: 829, HUF: 12990, RON: 169 },
  39: { GBP: 39, EUR: 45, PLN: 195, SEK: 499, DKK: 339, CZK: 1099, HUF: 17490, RON: 229 },
  49: { GBP: 49, EUR: 57, PLN: 245, SEK: 629, DKK: 429, CZK: 1399, HUF: 21990, RON: 289 },
}

const IMAGES = 'client/src/assets/images'

const candidateCourse = (key, fields) => ({ key, audience: 'candidate', cover: `${IMAGES}/learning-course-photo.jpg`, skillTags: [fields.category], ...fields, ...CANDIDATE_COURSE_CONTENT[key] })
const recruiterCourse = (key, photo, fields) => ({ key, audience: 'recruiter', cover: `${IMAGES}/recruiter-learning-${photo}.jpg`, skillTags: [fields.category], ...fields, ...RECRUITER_COURSE_CONTENT[key] })

const PRACTICE_ABOUT = 'Prototype one end-to-end flow. Include keyboard interaction, edge cases, empty states, and helpful errors.'
const PRACTICE_OUTCOMES = [
  'Apply core interaction design principles to a practical product challenge.',
  'Recognize common mistakes, edge cases, and responsible ways to evaluate your work.',
  'Create a small piece of evidence you can review before choosing whether to add it to your profile.',
]
const EVIDENCE_OUTCOME = PRACTICE_OUTCOMES[2]

export const COURSES = [
  candidateCourse('interaction-design-foundations', {
    title: 'Interaction design foundations',
    category: 'Interaction Design',
    level: 'foundation',
    price: 49,
    summary: 'Build clear flows, useful states, and accessible interactions through a practical product exercise.',
    about: PRACTICE_ABOUT,
    outcomes: PRACTICE_OUTCOMES,
  }),
  candidateCourse('interaction-systems-in-practice', {
    title: 'Interaction systems in practice',
    category: 'Interaction Design',
    level: 'intermediate',
    price: 39,
    summary: 'Turn interaction patterns into a coherent system that scales across a complex product.',
    about: PRACTICE_ABOUT,
    outcomes: PRACTICE_OUTCOMES,
  }),
  candidateCourse('designing-trusted-fintech-journeys', {
    title: 'Designing trusted fintech journeys',
    category: 'Fintech',
    level: 'foundation',
    price: 19,
    summary: 'Understand the trust, clarity, and risk patterns behind responsible financial product experiences.',
    about: 'Review one financial journey end to end. Name the moments that build or erode trust, and propose clearer alternatives.',
    outcomes: ['Explain how clarity and consent build trust in financial products.', PRACTICE_OUTCOMES[1], EVIDENCE_OUTCOME],
  }),
  candidateCourse('design-leadership-in-practice', {
    title: 'Design leadership in practice',
    category: 'Leadership',
    level: 'intermediate',
    price: 49,
    summary: 'Practice decision framing, critique, and evidence-led influence without relying on job title.',
    about: 'Prepare one real decision for your team: frame the options, gather evidence, and run a structured critique.',
    outcomes: ['Frame design decisions so a team can weigh the options.', 'Run a critique that stays specific, kind, and useful.', EVIDENCE_OUTCOME],
  }),
  candidateCourse('designing-for-developer-workflows', {
    title: 'Designing for developer workflows',
    category: 'Developer Tools',
    level: 'advanced',
    price: 49,
    summary: 'Research technical workflows and make dense operational information easier to understand.',
    about: 'Map one technical workflow, find where information overload slows people down, and redesign a single view.',
    outcomes: ['Research a technical workflow without assuming expert knowledge.', 'Structure dense operational information so it can be scanned.', EVIDENCE_OUTCOME],
  }),
  candidateCourse('evidence-led-user-interviews', {
    title: 'Evidence-led user interviews',
    category: 'User Interviews',
    level: 'foundation',
    price: 49,
    summary: 'Plan ethical interviews, ask neutral questions, and turn observations into careful findings.',
    about: 'Plan and rehearse a short interview, then turn your notes into three findings that cite what you heard.',
    outcomes: [
      'Plan an interview that respects participants and their time.',
      'Ask neutral questions that avoid leading people.',
      'Turn observations into careful findings you can stand behind.',
    ],
  }),
  recruiterCourse('hiring-technology-product-talent', 'technology', {
    title: 'Hiring Technology & Product Talent',
    category: 'SaaS & Technology',
    level: 'intermediate',
    price: 49,
    pipelineCategory: 'screening',
    summary: 'Understand technical disciplines, evaluate role evidence, and run credible hiring conversations without pretending to be the subject-matter expert.',
    lead: 'Build technology-domain fluency so you can read evidence, ask sharper questions, and partner confidently with hiring managers.',
    tagline: 'Practical learning for recruiters hiring in SaaS and technology.',
    designedFor: 'Recruiters hiring for SaaS, product, and technology teams',
    outcomes: [
      'Map technical roles and disciplines to the work they really do.',
      'Evaluate role evidence without relying on keyword matching.',
      'Hold credible conversations with candidates and engineers.',
    ],
  }),
  recruiterCourse('structured-interviewing-better-evidence', 'interviewing', {
    title: 'Structured Interviewing & Better Evidence',
    category: 'Interviewing',
    level: 'intermediate',
    price: 49,
    pipelineCategory: 'interview',
    summary: 'Plan focused interviews, ask consistent behavioural questions, and capture useful evidence without turning the conversation into a checklist.',
    lead: 'Plan focused interviews, ask consistent behavioural questions, and capture useful evidence without turning the conversation into a checklist.',
    tagline: 'Practical learning for thoughtful, evidence-led recruiters.',
    designedFor: 'Recruiters coordinating or conducting interviews',
    outcomes: [
      'Build an interview plan linked to role requirements.',
      'Collect comparable evidence across candidates.',
      'Facilitate a balanced debrief and challenge unsupported claims.',
    ],
  }),
  recruiterCourse('fair-hiring-inclusive-selection', 'technology', {
    title: 'Fair Hiring & Inclusive Selection',
    category: 'Fair Hiring',
    level: 'foundation',
    price: 49,
    pipelineCategory: 'shortlisted',
    summary: 'Recognise where bias creeps in, apply consistent criteria, and document decisions so every candidate receives a fair look.',
    lead: 'Recognise where bias creeps into hiring, apply consistent criteria, and document decisions so every candidate gets a fair look.',
    tagline: 'Practical learning for fair, well-documented hiring decisions.',
    designedFor: 'Recruiters and hiring managers responsible for selection decisions',
    outcomes: [
      'Spot common sources of bias across the hiring process.',
      'Apply the same criteria to every candidate.',
      'Record decisions in a way that can be reviewed and explained.',
    ],
  }),
  recruiterCourse('talent-strategy-workforce-planning', 'strategy', {
    title: 'Talent Strategy & Workforce Planning',
    category: 'Talent Strategy',
    level: 'advanced',
    price: 29,
    pipelineCategory: 'applied',
    summary: 'Connect hiring activity to workforce needs, prioritise scarce roles, and report recruiting performance with meaningful context.',
    lead: 'Connect hiring activity to workforce needs, prioritise scarce roles, and report recruiting performance with meaningful context.',
    tagline: 'Practical learning for planning hiring around business needs.',
    designedFor: 'Recruiting leads and talent partners planning hiring across teams',
    outcomes: [
      'Translate business plans into hiring priorities.',
      'Prioritise scarce roles and trade-offs with stakeholders.',
      'Report recruiting performance with context, not just counts.',
    ],
  }),
  recruiterCourse('employer-brand-candidate-experience', 'brand', {
    title: 'Employer Brand & Candidate Experience',
    category: 'Employer Brand',
    level: 'foundation',
    price: 29,
    pipelineCategory: 'offer',
    summary: 'Create honest employer messaging and a candidate journey that remains clear, responsive, and respectful from outreach to decision.',
    lead: 'Create honest employer messaging and a candidate journey that stays clear, responsive, and respectful from outreach to decision.',
    tagline: 'Practical learning for honest, respectful candidate journeys.',
    designedFor: 'Recruiters and employer-brand owners shaping the candidate journey',
    outcomes: [
      'Describe your company and roles honestly and specifically.',
      'Map the candidate journey and remove silent waiting.',
      'Close the loop with every candidate, including rejections.',
    ],
  }),
  recruiterCourse('recruiting-leadership-team-coaching', 'leadership', {
    title: 'Recruiting Leadership & Team Coaching',
    category: 'People Leadership',
    level: 'advanced',
    price: 29,
    pipelineCategory: 'hired',
    summary: 'Coach recruiters, set quality standards, and create operating rhythms that support accountable, sustainable hiring.',
    lead: 'Coach recruiters, set quality standards, and create operating rhythms that support accountable, sustainable hiring.',
    tagline: 'Practical learning for leaders who build strong recruiting teams.',
    designedFor: 'Recruiting managers and team leads',
    outcomes: [
      'Set clear quality standards for the team.',
      'Coach recruiters with specific, useful feedback.',
      'Run operating rhythms that keep hiring accountable and sustainable.',
    ],
  }),
]

// Task 4: the seed enrollments follow the seed course payments; Alex and Sarah have finished lesson 1.
export const LESSONS_DONE = { alex: 1, sarah: 1 }
