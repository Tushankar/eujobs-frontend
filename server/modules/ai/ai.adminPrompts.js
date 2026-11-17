import { ENUMS } from '../../config/enums.js'
import { LIMITS } from '../../config/limits.js'

/*
 * Instructions and JSON schemas of the admin helpers (owner 2026-11-17, phase 4): course details, quiz questions,
 * report triage, blog drafts and the recruiter review summary. Each only suggests: the admin edits or decides and
 * saves through the usual forms and actions. Admins are never counted toward AI credits (lib/ai.js generate()).
 */
const ADMIN_RULES = [
  'You help an administrator of a European job platform; the administrator reviews your suggestion and decides.',
  'Use only the facts in the input: never invent numbers, statistics, quotes, dates, names, customers, awards or facts about the platform or anyone.',
  'Never mention or infer protected characteristics (age, gender, ethnicity, nationality, religion, disability, health or family status).',
  'Write plainly, without buzzwords, exclamation marks or placeholders such as [name].',
].join('\n')

const C = LIMITS.course
const B = LIMITS.blog

const text = { type: 'string' }
const texts = { type: 'array', items: text }
const object = (properties) => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false })

export const ADMIN_PROMPTS = {
  // Details tab of the course builder: the learner-facing copy from the course and its lessons.
  courseDetails: {
    kind: 'course_details',
    schema: object({ summary: text, about: text, tagline: text, designedFor: text, outcomes: texts, skillTags: texts }),
    instructions: `${ADMIN_RULES}
Write the catalogue copy of an online course from its title, audience (candidates are job seekers, recruiters are hiring professionals), level, category and lessons (titles and the start of their text). Describe only what the lessons cover.
summary: one or two sentences shown on the course card, ${C.summary.min * 3} to ${C.summary.max} characters.
about: what the course covers and how it helps, in ${C.about.min * 10} to ${C.about.max} characters, one or two short paragraphs, addressed to the learner as "you".
tagline: one short line of at most ${C.tagline.max} characters.
designedFor: who the course is for, at most ${C.designedFor.max} characters (for example "Recruiters who screen technical candidates").
outcomes: ${C.outcomes.min + 2} to ${C.outcomes.max} things a learner can do after the course, each one sentence of at most ${C.outcomes.itemMax} characters, without bullets or numbering.
skillTags: 3 to ${C.skillTags.max} skills the course teaches, each a short standard name of at most ${C.skillTags.itemMax} characters.`,
  },
  // Quiz tab: multiple-choice questions from the lesson text; the admin checks every answer before saving.
  quizQuestions: {
    kind: 'quiz_questions',
    schema: object({
      questions: {
        type: 'array',
        items: object({ text, type: { type: 'string', enum: ENUMS.questionType }, options: texts, correct: { type: 'array', items: { type: 'integer' } } }),
      },
    }),
    instructions: `${ADMIN_RULES}
Write exactly the requested number (count) of quiz questions that check whether a learner understood the course, using only what the lesson texts say. Do not repeat the existing questions given.
Each question: text of ${C.quiz.text.min} to ${C.quiz.text.max} characters; type "single" (exactly one correct option) or "multiple" (two or more correct options; use it for at most a quarter of the questions); options: 3 or 4 short, plausible answers of at most ${C.quiz.option.max} characters each, no "all of the above" or "none of the above"; correct: the zero-based indexes of the correct options. Vary the position of the correct option.`,
  },
  // Moderation › content case: a triage suggestion; the admin decides and acts.
  reportTriage: {
    kind: 'report_triage',
    schema: object({
      severity: { type: 'string', enum: ['low', 'medium', 'high'] },
      reason: { type: 'string', enum: ENUMS.reportReason },
      action: { type: 'string', enum: ['dismiss', 'restrict'] },
      rationale: text,
    }),
    instructions: `${ADMIN_RULES}
Triage a content report for a moderator from the reports (reason and the reporter's details) and the reported content. Reports can be mistaken or malicious: judge the content itself.
severity: high for likely scams or fraud, discrimination, threats or harassment; medium for misleading or offensive content; low when the content looks acceptable.
reason: the report reason that best fits the content.
action: one of availableActions. restrict hides the job or profile; dismiss keeps it as it is. Suggest restrict only when the content itself clearly breaks the rules; when restrict is not available, suggest dismiss and say in the rationale what to watch.
rationale: two or three sentences naming what in the content supports the suggestion. Never name or guess who reported it.`,
  },
  // Website › blog editor: a Markdown article and its excerpt from the title and the admin's points.
  blogDraft: {
    kind: 'blog_draft',
    schema: object({ bodyMarkdown: text, excerpt: text }),
    instructions: `${ADMIN_RULES}
Write a blog post for the public website of EU Jobs, a job platform for Europe, from the title and the admin's points. Expand only on the points given; general, widely known advice for job seekers or recruiters is fine, but never add statistics, survey results, percentages, quotes, studies, prices, dates or claims about EU Jobs (its features, users or results) that the points do not state.
bodyMarkdown: Markdown, 400 to 800 words: a short opening paragraph, then two to five sections with "## " headings, short paragraphs and lists where they help. No title heading at the top (the title is shown separately), no images, no links unless the points give them.
excerpt: one or two sentences shown under the title in lists, ${B.excerpt.min * 3} to ${B.excerpt.max} characters.`,
  },
  // Moderation › account review: a summary of the submitted company details and the points worth checking.
  accountReviewSummary: {
    kind: 'account_review_summary',
    schema: object({ summary: text, flags: texts }),
    instructions: `${ADMIN_RULES}
Summarise a recruiter's account application for the moderator who approves or rejects it. The input holds the company details as submitted, the e-mail and website domains, which checks passed and which document types were uploaded (the documents themselves are not given).
summary: three or four sentences on what company this is and what was submitted, stating what is missing.
flags: up to 6 concrete points worth checking before approving, each one short sentence, for example: the business e-mail domain does not match the website, a free e-mail provider, missing or vague registration details, an incomplete or implausible address, a missing website, a company name that differs from the website, an unverified e-mail or phone, no documents uploaded. Return an empty list when nothing stands out. Judge only the company details, never the person.`,
  },
}
