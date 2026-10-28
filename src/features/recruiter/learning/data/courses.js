import technologyPhoto from '@/assets/images/recruiter-learning-technology.jpg'
import interviewingPhoto from '@/assets/images/recruiter-learning-interviewing.jpg'
import strategyPhoto from '@/assets/images/recruiter-learning-strategy.jpg'
import brandPhoto from '@/assets/images/recruiter-learning-brand.jpg'
import leadershipPhoto from '@/assets/images/recruiter-learning-leadership.jpg'

export const LEARNING_STORAGE_KEY = 'lwm.recruiter.learning'

/**
 * Persisted learning state: purchased course ids and the completed lesson ids per course.
 * The Figma stats open on "1 course in progress", so the first course starts purchased with lesson 1 done.
 */
export const INITIAL_LEARNING = {
  purchased: ['hiring-technology-product-talent'],
  completedLessons: { 'hiring-technology-product-talent': ['hiring-technology-product-talent-lesson-1'] },
}

export const LESSON_SUBTITLE = 'Guided lesson · Practical recruiter example'

function lessons(courseId, titles) {
  return titles.map((title, index) => ({ id: `${courseId}-lesson-${index + 1}`, title }))
}

/*
 * Course catalogue. Prices are one-time local prototype prices: nothing is ever charged.
 * `stream` is the specialist stream (one per Figma "Specialist streams" count of 6); `access` is the price caption.
 */
export const COURSES = [
  {
    id: 'hiring-technology-product-talent',
    title: 'Hiring Technology & Product Talent',
    stream: 'SaaS & Technology',
    level: 'Intermediate',
    duration: '2h 20m',
    price: 49,
    access: 'Lifetime course access',
    photo: technologyPhoto,
    summary:
      'Understand technical disciplines, evaluate role evidence, and run credible hiring conversations without pretending to be the subject-matter expert.',
    lead: 'Build technology-domain fluency so you can read evidence, ask sharper questions, and partner confidently with hiring managers.',
    tagline: 'Practical learning for recruiters hiring in SaaS and technology.',
    designedFor: 'Recruiters hiring for SaaS, product, and technology teams',
    outcomes: [
      'Map technical roles and disciplines to the work they really do.',
      'Evaluate role evidence without relying on keyword matching.',
      'Hold credible conversations with candidates and engineers.',
    ],
    lessons: lessons('hiring-technology-product-talent', [
      'Mapping technical roles and disciplines',
      'Reading evidence in technical profiles',
      'Writing clear role requirements',
      'Running credible technical conversations',
      'Closing the loop with hiring managers',
    ]),
  },
  {
    id: 'structured-interviewing-better-evidence',
    title: 'Structured Interviewing & Better Evidence',
    stream: 'Interviewing',
    level: 'Intermediate',
    duration: '2h',
    price: 49,
    access: 'One-time course access',
    photo: interviewingPhoto,
    summary: 'Plan focused interviews, ask consistent behavioural questions, and capture useful evidence without turning the conversation into a checklist.',
    lead: 'Plan focused interviews, ask consistent behavioural questions, and capture useful evidence without turning the conversation into a checklist.',
    tagline: 'Practical learning for thoughtful, evidence-led recruiters.',
    designedFor: 'Recruiters coordinating or conducting interviews',
    outcomes: [
      'Build an interview plan linked to role requirements.',
      'Collect comparable evidence across candidates.',
      'Facilitate a balanced debrief and challenge unsupported claims.',
    ],
    lessons: lessons('structured-interviewing-better-evidence', [
      'Defining competencies before the interview',
      'Building behavioural and situational questions',
      'Taking objective, candidate-aware notes',
      'Running effective interview debriefs',
      'Giving respectful candidate feedback',
    ]),
  },
  {
    id: 'fair-hiring-inclusive-selection',
    title: 'Fair Hiring & Inclusive Selection',
    stream: 'Fair Hiring',
    level: 'Foundation',
    duration: '1h 45m',
    price: 49,
    access: 'Lifetime course access',
    photo: technologyPhoto,
    summary: 'Recognise where bias creeps in, apply consistent criteria, and document decisions so every candidate receives a fair look.',
    lead: 'Recognise where bias creeps into hiring, apply consistent criteria, and document decisions so every candidate gets a fair look.',
    tagline: 'Practical learning for fair, well-documented hiring decisions.',
    designedFor: 'Recruiters and hiring managers responsible for selection decisions',
    outcomes: [
      'Spot common sources of bias across the hiring process.',
      'Apply the same criteria to every candidate.',
      'Record decisions in a way that can be reviewed and explained.',
    ],
    lessons: lessons('fair-hiring-inclusive-selection', [
      'Where bias enters the process',
      'Writing criteria before you screen',
      'Reviewing applications consistently',
      'Documenting decisions clearly',
      'Reviewing outcomes with a fairness lens',
    ]),
  },
  {
    id: 'talent-strategy-workforce-planning',
    title: 'Talent Strategy & Workforce Planning',
    stream: 'Talent Strategy',
    level: 'Advanced',
    duration: '2h 40m',
    price: 29,
    access: 'One-time course access',
    photo: strategyPhoto,
    summary: 'Connect hiring activity to workforce needs, prioritise scarce roles, and report recruiting performance with meaningful context.',
    lead: 'Connect hiring activity to workforce needs, prioritise scarce roles, and report recruiting performance with meaningful context.',
    tagline: 'Practical learning for planning hiring around business needs.',
    designedFor: 'Recruiting leads and talent partners planning hiring across teams',
    outcomes: [
      'Translate business plans into hiring priorities.',
      'Prioritise scarce roles and trade-offs with stakeholders.',
      'Report recruiting performance with context, not just counts.',
    ],
    lessons: lessons('talent-strategy-workforce-planning', [
      'Reading the business plan',
      'Forecasting hiring demand',
      'Prioritising scarce roles',
      'Building a pipeline plan',
      'Reporting performance with context',
    ]),
  },
  {
    id: 'employer-brand-candidate-experience',
    title: 'Employer Brand & Candidate Experience',
    stream: 'Employer Brand',
    level: 'Foundation',
    duration: '1h 30m',
    price: 29,
    access: 'One-time course access',
    photo: brandPhoto,
    summary: 'Create honest employer messaging and a candidate journey that remains clear, responsive, and respectful from outreach to decision.',
    lead: 'Create honest employer messaging and a candidate journey that stays clear, responsive, and respectful from outreach to decision.',
    tagline: 'Practical learning for honest, respectful candidate journeys.',
    designedFor: 'Recruiters and employer-brand owners shaping the candidate journey',
    outcomes: [
      'Describe your company and roles honestly and specifically.',
      'Map the candidate journey and remove silent waiting.',
      'Close the loop with every candidate, including rejections.',
    ],
    lessons: lessons('employer-brand-candidate-experience', [
      'Telling the truth about the role',
      'Writing outreach people answer',
      'Mapping the candidate journey',
      'Communicating at every stage',
      'Closing the loop respectfully',
    ]),
  },
  {
    id: 'recruiting-leadership-team-coaching',
    title: 'Recruiting Leadership & Team Coaching',
    stream: 'People Leadership',
    level: 'Advanced',
    duration: '2h 15m',
    price: 29,
    access: 'One-time course access',
    photo: leadershipPhoto,
    summary: 'Coach recruiters, set quality standards, and create operating rhythms that support accountable, sustainable hiring.',
    lead: 'Coach recruiters, set quality standards, and create operating rhythms that support accountable, sustainable hiring.',
    tagline: 'Practical learning for leaders who build strong recruiting teams.',
    designedFor: 'Recruiting managers and team leads',
    outcomes: [
      'Set clear quality standards for the team.',
      'Coach recruiters with specific, useful feedback.',
      'Run operating rhythms that keep hiring accountable and sustainable.',
    ],
    lessons: lessons('recruiting-leadership-team-coaching', [
      'Setting quality standards',
      'Coaching with evidence',
      'Running weekly pipeline reviews',
      'Managing workload sustainably',
      'Developing the next recruiters',
    ]),
  },
]

export const STREAMS = [...new Set(COURSES.map((course) => course.stream))]

/** The "Recommended for you" cards: a course, its overlay tag and why it is suggested (static prototype copy). */
export const SUGGESTIONS = [
  {
    courseId: 'hiring-technology-product-talent',
    tag: 'Best match',
    tone: 'info',
    reason: 'Enterprise SaaS and your current specialist roles make technology-domain fluency especially relevant.',
  },
  {
    courseId: 'structured-interviewing-better-evidence',
    tag: 'Suggestion 2',
    tone: 'accent',
    reason: 'Your workspace has 3 applications and 1 candidate at interview stage.',
  },
  {
    courseId: 'talent-strategy-workforce-planning',
    tag: 'Suggestion 3',
    tone: 'accent',
    reason: 'You are managing 3 published roles, so prioritisation and pipeline planning may be useful now.',
  },
]

export function getCourse(id) {
  return COURSES.find((course) => course.id === id)
}
