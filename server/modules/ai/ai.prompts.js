import { LIMITS } from '../../config/limits.js'

/*
 * Instructions and JSON schemas of every AI text (U4, M-057 … M-062, M-144). OpenAI only writes words around facts the
 * code supplies; the instructions forbid inventing facts and using protected characteristics (M-021, M-187).
 */
const RULES = [
  'You write for a European job platform. Use only the facts in the input; never invent employers, skills, numbers, dates or qualifications.',
  'Never mention or infer protected characteristics (age, gender, ethnicity, nationality, religion, disability, health or family status).',
  'Write plainly and briefly. Evidence is not a hiring decision, and a missing field is missing evidence, not a missing ability.',
].join('\n')

const text = { type: 'string' }
const texts = { type: 'array', items: text }
const object = (properties) => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false })
const snapshot = object({ role: text, years: { type: 'integer' }, skills: texts })

export const PROMPTS = {
  // M-058: a summary of one job for any reader (candidate, recruiter or admin).
  jobSummary: {
    kind: 'job_summary',
    schema: object({ overview: text, highlights: texts, considerations: texts }),
    instructions: `${RULES}\nSummarise the job posting: an overview of two or three sentences, up to four highlights and up to three points a reader should check (missing salary, unclear requirements, location limits).`,
  },
  // M-057: the narrative around the code evidence, for the candidate.
  candidateMatch: {
    kind: 'match_explanation',
    schema: object({ summary: text, strengths: texts, gaps: texts }),
    instructions: `${RULES}\nExplain to the candidate, addressed as "you", how their profile relates to this job, using the evidence block: a two-sentence summary, up to three strengths and up to three gaps or open questions. Do not mention any score or percentage.`,
  },
  // M-057, C6: the same for a recruiter, never with a score or a ranking.
  recruiterMatch: {
    kind: 'match_explanation',
    schema: object({ summary: text, strengths: texts, openQuestions: texts }),
    instructions: `${RULES}\nExplain to a recruiter how this candidate's profile relates to the job, using the evidence block: a two-sentence summary, up to three strengths and up to three open questions to ask in an interview. Never mention a score, a percentage or a ranking.`,
  },
  // M-057, M-066: the "Make the evidence visible" card of AI insights.
  insightsOverview: {
    kind: 'insights',
    schema: object({ text }),
    instructions: `${RULES}\nIn two or three sentences addressed to the candidate as "you", suggest how to show concrete evidence (outcomes, projects, own contribution) for the strength named in the input.`,
  },
  // M-064: one practical way to build evidence for each required skill the profile does not list.
  skillGap: {
    kind: 'insights',
    schema: object({ guidance: { type: 'array', items: object({ skill: text, text }) } }),
    instructions: `${RULES}\nFor each skill in missingSkills, in the same order and with the skill name exactly as given, write one or two sentences addressed to the candidate as "you" on a practical way to build or show evidence of it.`,
  },
  // §3.2: an improvement hint for each checklist area of the profile.
  improveProfile: {
    kind: 'insights',
    schema: object({ suggestions: { type: 'array', items: object({ area: text, text }) } }),
    instructions: `${RULES}\nFor each checklist area in the input, in the same order and with the area key exactly as given, write one sentence addressed to the candidate as "you": what to add when the area is not done, or how to make it clearer when it is done.`,
  },
  // M-067: why a job is recommended, as three reasons grounded on the evidence.
  whyRecommended: {
    kind: 'insights',
    schema: object({ reasons: { type: 'array', items: object({ title: text, text }) } }),
    instructions: `${RULES}\nGive exactly three reasons, in this order: listed skills, experience, work preferences and location. Each has a short title and one or two sentences addressed to the candidate as "you", grounded on the evidence block. Do not mention any score or percentage.`,
  },
  // M-062: a recruiter-ready summary of the candidate's own profile and live CV.
  profileSummary: {
    kind: 'profile_summary',
    schema: object({ summary: text }),
    instructions: `${RULES}\nWrite a recruiter-ready summary of this candidate in the third person: three to five sentences on role, experience, strongest skills and work preferences. No headings, no lists.`,
  },
  // Suggested replies under the latest message from the other side of a thread; the reader edits before sending.
  replySuggestions: {
    kind: 'reply_suggestions',
    schema: object({ replies: texts }),
    instructions: `${RULES}
Suggest exactly ${LIMITS.message.replySuggestions.count} short replies the reader ("you" in the input) could send next in this conversation between a candidate and a recruiter. Each reply answers the latest message, in the reader's own voice, polite and professional, at most two sentences.
Make them differ in intent (for example: say yes and move forward, ask one useful question, decline politely or propose a next step).
Never invent dates, times, salaries, availability, experience or contact details, and never use placeholders such as [name] or [date]; ask instead when a detail is needed.`,
  },
  // M-144: user content in the reader's language.
  translate: {
    kind: 'translation',
    schema: object({ texts }),
    instructions: 'Translate each text of the input into the requested language, keeping its meaning, tone, names, numbers and line breaks. Return the same number of texts in the same order. A text already in that language is returned unchanged.',
  },
  // M-027: a profile snapshot proposed from the CV text; the candidate confirms it (P9-Q3).
  cvSnapshot: {
    kind: 'cv_snapshot',
    schema: snapshot,
    instructions: `${RULES}\nFrom the CV text, propose the candidate's current or target role title (at most ${LIMITS.profile.headline.max} characters), their total years of professional experience as a whole number, and up to ${LIMITS.profile.skills.max} professional skills of at most ${LIMITS.profile.skills.itemMax} characters each, as written in the CV.`,
  },
  // M-061: suggestions and a revised snapshot; no new file.
  cvDraft: {
    kind: 'cv_draft',
    schema: object({ suggestions: texts, revisedSnapshot: snapshot }),
    instructions: `${RULES}\nReview the CV text for a candidate improving it: give three to six concrete suggestions addressed to the candidate as "you" (clearer impact, grouped skills, missing context), and a revised snapshot (role at most ${LIMITS.profile.headline.max} characters, whole years, up to ${LIMITS.profile.skills.max} skills of at most ${LIMITS.profile.skills.itemMax} characters) that the CV supports.`,
  },
}
