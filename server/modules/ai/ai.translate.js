import { AppError } from '../../lib/errors.js'
import { renderMarkdown } from '../../lib/markdown.js'
import { Company } from '../companies/companies.model.js'
import { accessibleCandidate } from '../discovery/discovery.service.js'
import { Job } from '../jobs/jobs.model.js'
import { jobDetails } from '../jobs/jobs.search.js'
import { Course } from '../learning/learning.model.js'
import { getCourse, getLesson } from '../learning/learning.service.js'
import { Conversation, Message } from '../messages/messages.model.js'
import { getMessages } from '../messages/messages.service.js'
import { CandidateProfile } from '../candidates/candidates.model.js'
import { write } from './ai.facts.js'
import { PROMPTS } from './ai.prompts.js'

/*
 * Translate on demand (M-144, M-088, M-113): the selected user texts, into the reader's language, cached per text and
 * language (the text itself is the key, so an edit makes a new entry). Skills and names are never translated.
 * Candidates need Plus (the route checks the `ai` entitlement); approved recruiters translate for free (M-117).
 * Each entity checks that the reader may see it, as the screen that shows it does.
 */
const SOURCES = {
  async job(user, { id, field }, company) {
    if (user.role === 'candidate') await jobDetails(user, id)
    const job = await Job.findOne({ _id: id, ...(user.role === 'recruiter' && { companyId: company._id }) })
    if (!job) throw new AppError('NOT_FOUND')
    return field === 'responsibilities' ? job.responsibilities : [job.brief ?? '']
  },
  // A company's About as candidates see it on job details (its jobs are visible) or the recruiter's own company.
  async company(user, { id }, company) {
    if (user.role === 'recruiter' && String(company._id) !== id) throw new AppError('NOT_FOUND')
    const found = await Company.findById(id, 'description')
    if (!found) throw new AppError('NOT_FOUND')
    if (user.role === 'candidate') {
      const job = await Job.findOne({ companyId: found._id, status: { $ne: 'draft' } }, '_id').sort({ publishedAt: -1 })
      if (!job) throw new AppError('NOT_FOUND')
      await jobDetails(user, job._id)
    }
    return [found.description ?? '']
  },
  // The recruiter's view of a candidate (P4-D11): the About and one work-history description.
  async candidate(user, { id, field, entryId }, company) {
    if (user.role !== 'recruiter') throw new AppError('FORBIDDEN')
    await accessibleCandidate(id, company)
    const profile = await CandidateProfile.findOne({ userId: id })
    if (field === 'about') return [profile.about ?? '']
    const entry = profile.workHistory.id(entryId)
    if (!entry) throw new AppError('NOT_FOUND')
    return [entry.description ?? '']
  },
  async message(user, { id }, company) {
    const message = await Message.findById(id)
    if (!message) throw new AppError('NOT_FOUND')
    await getMessages(user, company, message.conversationId)
    return [message.body]
  },
  // M-113: the course texts a learner sees; a text lesson is translated as Markdown and rendered again.
  async course(user, { id, field, entryId }) {
    if (field === 'lesson') {
      await getLesson(user, id, entryId)
      const lesson = (await Course.findById(id)).lessons.id(entryId)
      return [lesson.textMarkdown ?? '']
    }
    await getCourse(user, id)
    const course = await Course.findById(id, 'title summary about lead')
    return [course[field] ?? '']
  },
}

/** The candidate a translated text is about (a profile text, or any message of their thread), for erasure (M-188). */
const SUBJECTS = {
  candidate: ({ id }) => id,
  message: async ({ id }) => (await Conversation.findById((await Message.findById(id, 'conversationId')).conversationId, 'candidateId'))?.candidateId,
}

/** POST /translate: `{ texts }` in the reader's language, one per source text (responsibilities are several). */
export async function translate(user, company, body) {
  const texts = await SOURCES[body.entity](user, body, company)
  if (!texts.some((text) => text.trim())) return { texts }
  const { texts: translated } = await write(PROMPTS.translate, { user, subjectId: (await SUBJECTS[body.entity]?.(body)) ?? null, input: { language: user.language, texts } })
  if (body.entity === 'course' && body.field === 'lesson') return { texts: translated.map((markdown) => renderMarkdown(markdown)) }
  return { texts: translated }
}
