import { LIMITS } from '../../config/limits.js'
import { AppError, fieldError } from '../../lib/errors.js'
import { CandidateProfile } from '../candidates/candidates.model.js'
import { Company, KycDocument } from '../companies/companies.model.js'
import { Job } from '../jobs/jobs.model.js'
import { Course } from '../learning/learning.model.js'
import { ModerationCase } from '../moderation/moderation.model.js'
import { User } from '../users/users.model.js'
import { write } from './ai.facts.js'
import { ADMIN_PROMPTS } from './ai.adminPrompts.js'

/*
 * Admin helpers (owner 2026-11-17, phase 4). Each runs on the admin's click and only suggests: the client fills the
 * form (with Undo) or shows a panel, and the admin edits, decides and saves through the usual forms and actions.
 * Admins are never counted toward AI credits; the OpenAI budget pause still applies (lib/ai.js generate()). Answers
 * are cut to the forms' own limits, so a suggestion always saves.
 */
const C = LIMITS.course
const Q = C.quiz
const B = LIMITS.blog

// How much lesson text goes with a request: per lesson and in all.
const LESSON_CHARS = { details: 1500, quiz: 4000 }
const TOTAL_CHARS = { details: 9000, quiz: 24000 }
// Moderation texts: a report's details, the reported content and each message of an excerpt.
const CONTENT_CHARS = 2000
const RATIONALE_MAX = 600
const FLAGS_MAX = 6
const FLAG_MAX = 200
const SUMMARY_MAX = 800

const clip = (value, max) => String(value ?? '').trim().slice(0, max).trim()

/** Unique (case-insensitive), non-empty, each cut to `itemMax`, at most `max`. */
function names(items, { itemMax, max }) {
  const seen = new Set()
  const out = []
  for (const item of items ?? []) {
    const name = clip(item, itemMax)
    if (!name || seen.has(name.toLowerCase())) continue
    seen.add(name.toLowerCase())
    out.push(name)
  }
  return out.slice(0, max)
}

/* ---------- course builder ---------- */

async function findCourse(id) {
  const course = await Course.findById(id)
  if (!course) throw new AppError('NOT_FOUND')
  return course
}

/** The lessons' titles and the start of their text, at most `total` characters of text in all. */
function lessonFacts(course, perLesson, total) {
  let left = total
  return course.lessons.map((lesson) => {
    const body = clip(lesson.textMarkdown, Math.min(perLesson, left))
    left -= body.length
    return { title: lesson.title, type: lesson.type, text: body || null }
  })
}

/**
 * POST /admin/ai-drafts/courses/:id/details: summary, about, tagline, designedFor, outcomes and skill tags from the
 * course and its lessons. The form's unsaved title, category and level win over the saved ones.
 */
export async function courseDetails(admin, id, form) {
  const course = await findCourse(id)
  const input = {
    title: form.title || course.title,
    audience: course.audience,
    level: form.level ?? course.level ?? null,
    category: form.category || course.category || null,
    lessons: lessonFacts(course, LESSON_CHARS.details, TOTAL_CHARS.details),
  }
  const draft = await write(ADMIN_PROMPTS.courseDetails, { user: admin, input })
  return {
    summary: clip(draft.summary, C.summary.max),
    about: clip(draft.about, C.about.max),
    tagline: clip(draft.tagline, C.tagline.max),
    designedFor: clip(draft.designedFor, C.designedFor.max),
    outcomes: names(draft.outcomes, C.outcomes),
    skillTags: names(draft.skillTags, C.skillTags),
  }
}

/**
 * One AI question in the quiz editor's shape, or null when it cannot be saved as is: blank or duplicate options are
 * dropped (the correct indexes follow), a "single" question with several correct options becomes "multiple", and a
 * question without a correct option, with fewer than two options or too short a text is dropped.
 */
export function cleanQuestion(question) {
  const text = clip(question.text, Q.text.max)
  if (text.length < Q.text.min) return null
  const seen = new Set()
  const options = []
  const correct = []
  question.options.forEach((option, index) => {
    const value = clip(option, Q.option.max)
    if (!value || seen.has(value.toLowerCase()) || options.length >= Q.options.max) return
    seen.add(value.toLowerCase())
    if (question.correct.includes(index)) correct.push(options.length)
    options.push({ text: value })
  })
  if (options.length < Q.options.min || !correct.length) return null
  return { text, type: correct.length > 1 ? 'multiple' : question.type, options, correct }
}

/**
 * POST /admin/ai-drafts/courses/:id/quiz-questions: `count` new questions from the lesson text, never repeating the
 * saved ones; the client appends them to the editor. A course without lesson text gets VALIDATION_FAILED.
 */
export async function quizQuestions(admin, id, { count }) {
  const course = await findCourse(id)
  const lessons = lessonFacts(course, LESSON_CHARS.quiz, TOTAL_CHARS.quiz).filter((lesson) => lesson.text)
  if (!lessons.length) throw fieldError({ lessons: 'no_text' })
  const input = { course: course.title, count, lessons, existingQuestions: course.quiz.questions.map((question) => question.text) }
  const { questions } = await write(ADMIN_PROMPTS.quizQuestions, { user: admin, input, model: 'main', cache: false })
  const known = new Set(input.existingQuestions.map((value) => value.toLowerCase()))
  return {
    questions: questions
      .map(cleanQuestion)
      .filter((question) => question && !known.has(question.text.toLowerCase()) && known.add(question.text.toLowerCase()))
      .slice(0, count),
  }
}

/* ---------- moderation ---------- */

const EMAIL = /[\w.+-]+@[\w-]+(\.[\w-]+)+/g
const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** A text without e-mail addresses or the given names (the reporters'), cut to `max`. */
function scrub(value, people, max = CONTENT_CHARS) {
  let out = String(value ?? '').replace(EMAIL, '[email]')
  for (const name of people) out = out.replace(new RegExp(escape(name), 'gi'), '[reporter]')
  return clip(out, max)
}

/** The reported content as the AI reads it: never a candidate's name or photo, never who reported it. */
async function reportedContent(item, scrubbed) {
  if (item.targetType === 'message') return { messages: item.excerpt.map(({ senderRole, body, reported }) => ({ from: senderRole, text: scrubbed(body), reported: Boolean(reported) })) }
  if (item.targetType === 'job') {
    const job = await Job.findById(item.targetId, 'title brief responsibilities companyId')
    const company = job && (await Company.findById(job.companyId, 'displayName'))
    return job ? { title: job.title, company: company?.displayName ?? null, brief: scrubbed(job.brief), responsibilities: job.responsibilities.map((line) => scrubbed(line, 300)) } : null
  }
  if (item.targetType === 'candidate_profile') {
    const profile = await CandidateProfile.findOne({ userId: item.targetId }, 'headline about')
    return profile ? { headline: scrubbed(profile.headline), about: scrubbed(profile.about) } : null
  }
  const company = await Company.findById(item.targetId, 'displayName description')
  return company ? { name: company.displayName, description: scrubbed(company.description) } : null
}

/** The decisions a case allows now (as moderation.service.js): restrict only for open job and profile cases. */
const availableActions = (item) => (item.status === 'open' && ['job', 'candidate_profile'].includes(item.targetType) ? ['dismiss', 'restrict'] : ['dismiss'])

/**
 * POST /admin/ai-drafts/moderation/cases/:id/triage: severity, the best-fitting reason, a suggested action and a short
 * rationale. Reporters are never named: their names and any e-mail address are taken out of every text sent.
 */
export async function reportTriage(admin, id) {
  const item = await ModerationCase.findById(id)
  if (!item) throw new AppError('NOT_FOUND')
  const reporters = await User.find({ _id: { $in: item.reports.map((entry) => entry.reporterId).filter(Boolean) } }, 'fullName')
  const people = reporters.map((reporter) => reporter.fullName?.trim()).filter((name) => name && name.length > 2)
  const scrubbed = (value, max) => scrub(value, people, max)
  const actions = availableActions(item)
  const input = {
    contentType: item.targetType,
    availableActions: actions,
    reports: item.reports.map((entry) => ({ reason: entry.reason, details: scrubbed(entry.details, LIMITS.report.details.max) || null })),
    content: await reportedContent(item, scrubbed),
  }
  const triage = await write(ADMIN_PROMPTS.reportTriage, { user: admin, input, subjectId: item.ownerId ?? null })
  return { severity: triage.severity, reason: triage.reason, action: actions.includes(triage.action) ? triage.action : 'dismiss', rationale: clip(triage.rationale, RATIONALE_MAX) }
}

const domainOf = (value) => {
  const text = String(value ?? '').trim().toLowerCase()
  if (!text) return null
  if (text.includes('@')) return text.split('@').pop() || null
  try {
    return new URL(/^https?:\/\//.test(text) ? text : `https://${text}`).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

/** Whether an e-mail domain is the website's domain or a subdomain of it (either way). */
const sameDomain = (a, b) => Boolean(a && b && (a === b || a.endsWith(`.${b}`) || b.endsWith(`.${a}`)))

/**
 * POST /admin/ai-drafts/moderation/accounts/:userId/summary: a short summary of the submitted company details and the
 * points worth checking. Only domains of the e-mail addresses go, never the documents, the person's name or phone
 * number; cached per submitted details.
 */
export async function accountSummary(admin, userId) {
  const user = await User.findOne({ _id: userId, role: 'recruiter' })
  if (!user) throw new AppError('NOT_FOUND')
  const company = await Company.findOne({ ownerUserId: user._id })
  const documents = company ? await KycDocument.find({ companyId: company._id }, 'type fileId') : []
  const website = domainOf(company?.website)
  const businessEmailDomain = domainOf(company?.businessEmail)
  const input = {
    recruiterJobTitle: user.jobTitle || null,
    accountEmailDomain: domainOf(user.email),
    emailVerified: Boolean(user.emailVerifiedAt),
    phoneVerified: Boolean(user.phone?.verifiedAt),
    company: company && {
      legalName: company.legalName,
      displayName: company.displayName,
      website: company.website || null,
      websiteDomain: website,
      businessEmailDomain,
      businessEmailMatchesWebsite: website && businessEmailDomain ? sameDomain(businessEmailDomain, website) : null,
      industry: company.industry || null,
      size: company.size || null,
      city: company.location?.city ?? null,
      countryCode: company.location?.countryCode ?? null,
      businessAddress: company.businessAddress || null,
      registrationDetails: company.registrationDetails || null,
    },
    uploadedDocumentTypes: [...new Set(documents.filter((document) => document.fileId).map((document) => document.type))],
  }
  const { summary, flags } = await write(ADMIN_PROMPTS.accountReviewSummary, { user: admin, input, subjectId: user._id })
  return { summary: clip(summary, SUMMARY_MAX), flags: names(flags, { itemMax: FLAG_MAX, max: FLAGS_MAX }) }
}

/* ---------- website ---------- */

/** POST /admin/ai-drafts/blog-draft: a Markdown article and its excerpt from the title and the admin's points. */
export async function blogDraft(admin, { title, points }) {
  const draft = await write(ADMIN_PROMPTS.blogDraft, { user: admin, input: { title, points }, cache: false })
  return { bodyMarkdown: clip(draft.bodyMarkdown, B.body.max), excerpt: clip(draft.excerpt, B.excerpt.max) }
}
