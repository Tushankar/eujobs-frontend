export const LEARNING_STORAGE_KEY = 'lwm.candidate.learning'

/** Persisted learning state: purchased course ids and the completed lesson ids per course. */
export const INITIAL_LEARNING = {
  purchased: ['interaction-design-foundations'],
  completedLessons: {},
}

export const LEVELS = ['Foundation', 'Intermediate', 'Advanced']

/** Skills the candidate could explore, per the "Skills to explore" stat. */
export const SKILLS_TO_EXPLORE = 6

export const GAP_SKILL = 'Interaction Design'

const INTRO_OUTCOMES = {
  apply: 'Apply core interaction design principles to a practical product challenge.',
  mistakes: 'Recognize common mistakes, edge cases, and responsible ways to evaluate your work.',
  evidence: 'Create a small piece of evidence you can review before choosing whether to add it to your profile.',
}

const OUTCOMES = [INTRO_OUTCOMES.apply, INTRO_OUTCOMES.mistakes, INTRO_OUTCOMES.evidence]

function lessons(courseId, titles) {
  return titles.map((title, index) => ({ id: `${courseId}-lesson-${index + 1}`, title }))
}

/**
 * Course catalogue. Prices are one-time local prototype prices: no payment is ever taken.
 * `tier` is the Figma "Included" / "Plus" tag; `recommended` marks the courses suggested for the skill gap.
 */
export const COURSES = [
  {
    id: 'interaction-design-foundations',
    title: 'Interaction design foundations',
    category: 'Interaction Design',
    level: 'Foundation',
    duration: '2h 20m',
    tier: 'Included',
    price: 49,
    recommended: true,
    summary: 'Build clear flows, useful states, and accessible interactions through a practical product exercise.',
    about: 'Prototype one end-to-end flow. Include keyboard interaction, edge cases, empty states, and helpful errors.',
    outcomes: OUTCOMES,
    lessons: lessons('interaction-design-foundations', [
      'Mapping a user flow',
      'Designing useful states',
      'Making interactions accessible',
      'Reviewing your exercise',
    ]),
  },
  {
    id: 'interaction-systems-in-practice',
    title: 'Interaction systems in practice',
    category: 'Interaction Design',
    level: 'Intermediate',
    duration: '3h 10m',
    tier: 'Plus',
    price: 39,
    recommended: true,
    summary: 'Turn interaction patterns into a coherent system that scales across a complex product.',
    about: 'Prototype one end-to-end flow. Include keyboard interaction, edge cases, empty states, and helpful errors.',
    outcomes: OUTCOMES,
    lessons: lessons('interaction-systems-in-practice', [
      'Mapping recurring interaction patterns',
      'Writing behavior specifications',
      'Testing edge cases',
      'Reviewing a system with engineers',
    ]),
  },
  {
    id: 'designing-trusted-fintech-journeys',
    title: 'Designing trusted fintech journeys',
    category: 'Fintech',
    level: 'Foundation',
    duration: '2h 45m',
    tier: 'Included',
    price: 19,
    recommended: true,
    summary: 'Understand the trust, clarity, and risk patterns behind responsible financial product experiences.',
    about: 'Review one financial journey end to end. Name the moments that build or erode trust, and propose clearer alternatives.',
    outcomes: [
      'Explain how clarity and consent build trust in financial products.',
      INTRO_OUTCOMES.mistakes,
      'Create a small piece of evidence you can review before choosing whether to add it to your profile.',
    ],
    lessons: lessons('designing-trusted-fintech-journeys', [
      'What makes a financial journey feel safe',
      'Explaining risk in plain language',
      'Designing consent and confirmation',
      'Reviewing a journey for trust',
    ]),
  },
  {
    id: 'design-leadership-in-practice',
    title: 'Design leadership in practice',
    category: 'Leadership',
    level: 'Intermediate',
    duration: '3h 30m',
    tier: 'Plus',
    price: 49,
    recommended: false,
    summary: 'Practice decision framing, critique, and evidence-led influence without relying on job title.',
    about: 'Prepare one real decision for your team: frame the options, gather evidence, and run a structured critique.',
    outcomes: [
      'Frame design decisions so a team can weigh the options.',
      'Run a critique that stays specific, kind, and useful.',
      INTRO_OUTCOMES.evidence,
    ],
    lessons: lessons('design-leadership-in-practice', [
      'Framing a decision',
      'Running a useful critique',
      'Influencing with evidence',
      'Reflecting on your approach',
    ]),
  },
  {
    id: 'designing-for-developer-workflows',
    title: 'Designing for developer workflows',
    category: 'Developer Tools',
    level: 'Advanced',
    duration: '4h 05m',
    tier: 'Plus',
    price: 49,
    recommended: false,
    summary: 'Research technical workflows and make dense operational information easier to understand.',
    about: 'Map one technical workflow, find where information overload slows people down, and redesign a single view.',
    outcomes: [
      'Research a technical workflow without assuming expert knowledge.',
      'Structure dense operational information so it can be scanned.',
      INTRO_OUTCOMES.evidence,
    ],
    lessons: lessons('designing-for-developer-workflows', [
      'Researching technical workflows',
      'Structuring dense information',
      'Designing for keyboard and command use',
      'Reviewing with engineers',
    ]),
  },
  {
    id: 'evidence-led-user-interviews',
    title: 'Evidence-led user interviews',
    category: 'User Interviews',
    level: 'Foundation',
    duration: '1h 55m',
    tier: 'Included',
    price: 49,
    recommended: false,
    summary: 'Plan ethical interviews, ask neutral questions, and turn observations into careful findings.',
    about: 'Plan and rehearse a short interview, then turn your notes into three findings that cite what you heard.',
    outcomes: [
      'Plan an interview that respects participants and their time.',
      'Ask neutral questions that avoid leading people.',
      'Turn observations into careful findings you can stand behind.',
    ],
    lessons: lessons('evidence-led-user-interviews', [
      'Planning an ethical interview',
      'Asking neutral questions',
      'Capturing observations',
      'Writing careful findings',
    ]),
  },
]

export function findCourse(courseId) {
  return COURSES.find((course) => course.id === courseId)
}
