import { z } from 'zod'
import { ENUMS } from '../../config/enums.js'
import { LIMITS } from '../../config/limits.js'
import { objectId } from '../../lib/validate.js'

/*
 * Course builder and learner requests (§3.9, P8-C1). A draft checks formats only; publishing checks everything in
 * the service (as job drafts, P4-D7). Optional texts accept '' to clear them. Quiz answers are option indexes.
 */
const C = LIMITS.course

export const idParams = z.object({ id: objectId })
export const lessonParams = z.object({ id: objectId, lessonId: objectId })
export const audienceQuery = z.object({ audience: z.enum(ENUMS.courseAudience) })
export const uploadQuery = z.object({ purpose: z.enum(['course_cover', 'lesson_video', 'lesson_document']) })
export const markdownBody = z.object({ markdown: z.string().max(C.lessonText.max) })

const text = (max) => z.string().trim().max(max)
const title = z.string().trim().min(C.title.min).max(C.title.max)

export const createBody = z.object({ audience: z.enum(ENUMS.courseAudience), title })

export const detailsBody = z
  .object({
    title,
    category: text(C.category.max),
    level: z.enum(ENUMS.courseLevel).nullable(),
    language: z.enum(ENUMS.language),
    summary: text(C.summary.max),
    about: text(C.about.max),
    lead: text(C.about.max),
    tagline: text(C.tagline.max),
    designedFor: text(C.designedFor.max),
    outcomes: z.array(z.string().trim().min(1).max(C.outcomes.itemMax)).max(C.outcomes.max),
    skillTags: z.array(z.string().trim().min(1).max(C.skillTags.itemMax)).max(C.skillTags.max),
    pipelineCategory: z.enum(ENUMS.stageCategory).nullable(),
    coverFileId: objectId.nullable(),
    isFree: z.boolean(),
    prices: z.array(z.object({ currency: z.string().trim().toUpperCase().length(3), amountMinor: z.number().int().min(C.amountMinor.min).max(C.amountMinor.max) })),
  })
  .partial()

// https only (U16); the length limit comes from the admin audit (§9.1).
const httpsUrl = z.url({ protocol: /^https$/ }).max(C.lessonUrl.max)

const lessonFields = {
  title: z.string().trim().min(C.lessonTitle.min).max(C.lessonTitle.max),
  durationSec: z.number().int().min(C.durationSec.min).max(C.durationSec.max).nullable(),
  videoFileId: objectId.nullable(),
  documentFileId: objectId.nullable(),
  textMarkdown: z.string().max(C.lessonText.max),
  url: z.union([z.literal(''), httpsUrl]),
  isPreview: z.boolean(),
  contentLanguage: z.enum(ENUMS.language).nullable(),
}

export const lessonBody = z.object(lessonFields).partial().extend({ title: lessonFields.title, type: z.enum(ENUMS.lessonType) })
export const lessonPatchBody = z.object(lessonFields).partial()
export const orderBody = z.object({ lessonIds: z.array(objectId).max(C.lessons.max) })

const question = z
  .object({
    text: z.string().trim().min(C.quiz.text.min).max(C.quiz.text.max),
    type: z.enum(ENUMS.questionType),
    options: z.array(z.object({ text: z.string().trim().min(1).max(C.quiz.option.max) })).min(C.quiz.options.min).max(C.quiz.options.max),
    correct: z.array(z.number().int().min(0)),
  })
  .superRefine((value, ctx) => {
    // M-104: single choice has exactly one correct option, multiple choice at least one.
    const count = new Set(value.correct).size
    const inRange = count === value.correct.length && value.correct.every((index) => index < value.options.length)
    if (!inRange || count === 0 || (value.type === 'single' && count !== 1)) ctx.addIssue({ code: 'custom', path: ['correct'], message: 'invalid' })
  })

export const quizBody = z.object({
  passMark: z.number().int().min(C.passMark.min).max(C.passMark.max),
  questions: z.array(question).max(C.quiz.questions.max),
})

export const statusBody = z.object({ status: z.enum(['published', 'unpublished']) })

export const enrollBody = z.object({ courseId: objectId })

// U15: a heartbeat sends the playback position and rate; `open` marks a text, PDF or link lesson viewed.
export const lessonIdParams = z.object({ lessonId: objectId })
export const progressBody = z.discriminatedUnion('event', [
  z.object({ event: z.literal('open') }),
  z.object({ event: z.literal('heartbeat'), positionSec: z.number().min(0).max(C.durationSec.max), rate: z.number().min(0).max(16) }),
])

// M-104: each answer names the question and the chosen options (one for single choice, any for multiple).
export const attemptBody = z.object({
  answers: z.array(z.object({ questionId: objectId, optionIds: z.array(objectId).max(C.quiz.options.max) })).max(C.quiz.questions.max),
})

export const codeParams = z.object({ code: z.string().trim().regex(/^LWM-[A-Z\d]{4}-[A-Z\d]{4}$/i) })
export const revokeBody = z.object({ reason: z.string().trim().min(LIMITS.certificate.revokeReason.min).max(LIMITS.certificate.revokeReason.max) })
