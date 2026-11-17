import { randomUUID } from 'node:crypto'
import { rename, unlink } from 'node:fs/promises'
import ISO6391 from 'iso-639-1'
import { LIMITS } from '../../config/limits.js'
import { releaseCredits, reserveCredits, transcribe } from '../../lib/ai.js'
import { AppError, fieldError } from '../../lib/errors.js'
import { skillKey } from '../../lib/skills.js'
import { loadProfile, saveProfile } from '../candidates/candidates.service.js'
import { Company } from '../companies/companies.model.js'
import { Interview } from '../interviews/interviews.model.js'
import { Job } from '../jobs/jobs.model.js'
import { jobDetails } from '../jobs/jobs.search.js'
import { autocomplete, placeDetails } from '../places/places.service.js'
import { candidateSubject, jobFacts, write } from './ai.facts.js'
import { PROMPTS } from './ai.prompts.js'

/*
 * Candidate drafts (owner 2026-11-17, phase 3): cover note, job alert from a sentence, headline and About, interview
 * prep and the voice profile. Each is one AI use of the candidate's daily cap (a cached answer is free) and only a
 * draft: the client puts it into the form and the candidate edits and saves as usual. Answers are cut to the form's
 * own limits. The facts never include a photo or anything protected (ai.facts.js).
 */
const P = LIMITS.profile
const clip = (value, max) => String(value ?? '').trim().slice(0, max).trim()

/** The candidate's facts, or a 422 when there is no profile yet to write from. */
async function ownFacts(user) {
  const { facts } = await candidateSubject(user._id)
  if (!facts) throw new AppError('VALIDATION_FAILED', { fields: { profile: 'required' } })
  return facts
}

const companyFacts = async (job) => {
  const company = await Company.findById(job.companyId, 'displayName industry size description')
  return company && { name: company.displayName, industry: company.industry ?? null, size: company.size ?? null, about: company.description?.slice(0, 600) || null }
}

/** POST /candidate/ai/cover-note: a cover note for a job the candidate can see, never cached (asking again gives a new one). */
export async function coverNote(user, { jobId, notes }) {
  await jobDetails(user, jobId)
  const job = await Job.findById(jobId)
  const input = { job: await jobFacts(job), company: await companyFacts(job), candidate: await ownFacts(user), notes: notes || null }
  const { coverNote: text } = await write(PROMPTS.coverNote, { user, input, subjectId: user._id, cache: false })
  return { coverNote: clip(text, LIMITS.application.coverNote.max) }
}

/**
 * The place a city name means: Google's suggestions for "city", the first whose details are in `countryCode` (or
 * the first allowed one when no country was named). Null when nothing matches; the candidate then picks the city.
 */
async function findCity(user, city, countryCode) {
  if (!city) return null
  const sessionToken = randomUUID()
  const suggestions = await autocomplete({ input: clip(city, LIMITS.places.input.max), language: user.language, sessionToken, userId: user._id })
  for (const suggestion of suggestions.slice(0, 3)) {
    try {
      const place = await placeDetails({ placeId: suggestion.placeId, language: user.language, sessionToken, userId: user._id })
      if (!countryCode || place.countryCode === countryCode.toUpperCase()) return place
    } catch {
      // A place outside the platform's countries: try the next suggestion.
    }
  }
  return null
}

/**
 * POST /candidate/ai/job-alert: a job alert's name, keywords, frequency and city from one sentence. The city must be
 * in the view the alert is made in (`country`): none for Remote, any country for Worldwide, otherwise that country
 * (an alert cannot be saved with a city elsewhere).
 */
export async function jobAlertDraft(user, { text, country }) {
  const draft = await write(PROMPTS.jobAlertDraft, { user, input: { sentence: text }, subjectId: user._id })
  const A = LIMITS.jobAlert
  let place = null
  try {
    if (country !== 'REMOTE') place = await findCity(user, draft.city.trim(), country && country !== 'WORLDWIDE' ? country : draft.countryCode.trim())
  } catch {
    // Places unavailable: the candidate picks the city.
  }
  return { name: clip(draft.name, A.name.max), keywords: clip(draft.keywords, A.keywords.max), frequency: draft.frequency, place, city: draft.city.trim() || null }
}

/** POST /candidate/ai/profile-text: a headline and About from the profile; cached by the facts. */
export async function profileText(user) {
  const { headline, about } = await write(PROMPTS.profileText, { user, input: await ownFacts(user), subjectId: user._id })
  return { headline: clip(headline, P.headline.max), about: clip(about, P.about.max) }
}

/** POST /candidate/ai/interviews/:id/prep: likely questions with talking points; cached per interview facts. */
export async function interviewPrep(user, id) {
  const interview = await Interview.findOne({ _id: id, candidateId: user._id, status: { $in: ['confirmed', 'completed'] } })
  if (!interview) throw new AppError('NOT_FOUND')
  const job = await Job.findById(interview.jobId)
  if (!job) throw new AppError('NOT_FOUND')
  const input = { job: await jobFacts(job), company: await companyFacts(job), mode: interview.mode, candidate: await ownFacts(user) }
  const prep = await write(PROMPTS.interviewPrep, { user, input, subjectId: user._id })
  return {
    questions: prep.questions.filter((item) => item.question.trim()).slice(0, 8).map(({ question, talkingPoint }) => ({ question: question.trim(), talkingPoint: talkingPoint.trim() })),
    askThem: prep.askThem.map((item) => item.trim()).filter(Boolean).slice(0, 3),
  }
}

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/

/** The voice profile cut to the profile's limits: valid months, ISO languages, unique skills. */
export function cleanVoiceProfile(draft) {
  const seen = new Set()
  const codes = new Set()
  return {
    headline: clip(draft.headline, P.headline.max),
    about: clip(draft.about, P.about.max),
    yearsExperience: Math.min(P.yearsExperience.max, Math.max(P.yearsExperience.min, Math.round(draft.yearsExperience || 0))),
    skills: draft.skills
      .map((skill) => clip(skill, P.skills.itemMax))
      .filter((skill) => skill && !seen.has(skill.toLowerCase()) && seen.add(skill.toLowerCase()))
      .slice(0, P.skills.max),
    workHistory: draft.workHistory
      .filter((entry) => entry.title.trim() && entry.employer.trim())
      .slice(0, P.workHistory.max)
      .map((entry) => ({
        title: clip(entry.title, P.entryText.max),
        employer: clip(entry.employer, P.entryText.max),
        start: MONTH.test(entry.start) ? entry.start : null,
        end: entry.current || !MONTH.test(entry.end) ? null : entry.end,
        current: Boolean(entry.current),
      })),
    education: draft.education
      .filter((entry) => entry.degree.trim() && entry.institution.trim())
      .slice(0, P.education.max)
      .map((entry) => ({ degree: clip(entry.degree, P.entryText.max), institution: clip(entry.institution, P.entryText.max) })),
    languages: draft.languages
      .map(({ code, level }) => ({ code: code.trim().toLowerCase(), level }))
      .filter(({ code }) => ISO6391.validate(code) && !codes.has(code) && codes.add(code))
      .slice(0, P.languages.max),
  }
}

/**
 * POST /candidate/ai/voice-profile (multipart `file`, up to 3 minutes): the recording is transcribed and deleted at
 * once (never stored), and the transcript becomes a profile proposal the candidate reviews. Returns the proposal and
 * the transcript, so they can see what was heard. The voice credits (and a burst slot) are reserved BEFORE the paid
 * transcription; they are given back only when OpenAI fails. A recording with too little speech keeps them: the
 * transcription was paid, and free retries would make the cap pointless. The upload size cap (LIMITS.uploads) bounds
 * the length on the server; the client stops at LIMITS.ai.voice.maxSeconds.
 */
export async function voiceProfile(user, file) {
  // OpenAI reads the audio format from the file name, and multer's temp file has none.
  const path = `${file.path}.${file.ext}`
  let reserved = null
  let transcript
  try {
    reserved = await reserveCredits(user, PROMPTS.voiceProfile.kind)
    await rename(file.path, path)
    transcript = (await transcribe(path, user)).trim()
  } catch (error) {
    if (reserved) await releaseCredits(user, reserved)
    throw error
  } finally {
    await Promise.all([unlink(file.path).catch(() => {}), unlink(path).catch(() => {})])
  }
  if (transcript.length < LIMITS.ai.voice.minTranscriptChars) throw fieldError({ file: 'too_short' })
  try {
    const draft = await write(PROMPTS.voiceProfile, { user, input: { transcript: transcript.slice(0, LIMITS.ai.voice.maxTranscriptChars) }, subjectId: user._id, cache: false, charge: false })
    return { profile: cleanVoiceProfile(draft), transcript }
  } catch (error) {
    await releaseCredits(user, reserved)
    throw error
  }
}

const sameEntry = (a, b, fields) => fields.every((field) => (a[field] ?? '').trim().toLowerCase() === (b[field] ?? '').trim().toLowerCase())

/**
 * POST /candidate/ai/voice-profile/apply: the reviewed proposal joins the profile without removing anything. Headline,
 * About and years are set when given; skills, jobs, education and languages the profile does not have yet are added up
 * to the profile's limits.
 */
export async function applyVoiceProfile(user, proposal) {
  const profile = await loadProfile(user._id)
  const clean = cleanVoiceProfile({ ...proposal, workHistory: proposal.workHistory.map((entry) => ({ ...entry, start: entry.start ?? '', end: entry.end ?? '' })) })
  if (clean.headline) profile.headline = clean.headline
  if (clean.about.length >= P.about.min) profile.about = clean.about
  if (clean.yearsExperience > 0) profile.yearsExperience = clean.yearsExperience
  const keys = new Set(profile.skills.map((skill) => skill.key))
  const skills = clean.skills.filter((name) => !keys.has(skillKey(name))).slice(0, Math.max(0, P.skills.max - profile.skills.length))
  profile.skills.push(...skills.map((name) => ({ name, key: skillKey(name) })))
  const jobs = clean.workHistory.filter((entry) => !profile.workHistory.some((own) => sameEntry(own, entry, ['title', 'employer'])))
  profile.workHistory.push(...jobs.slice(0, Math.max(0, P.workHistory.max - profile.workHistory.length)).map(({ title, employer, start, end, current }) => ({ title, employer, start: start ?? undefined, end: end ?? undefined, current })))
  const studies = clean.education.filter((entry) => !profile.education.some((own) => sameEntry(own, entry, ['degree', 'institution'])))
  profile.education.push(...studies.slice(0, Math.max(0, P.education.max - profile.education.length)))
  const spoken = new Set(profile.languages.map((language) => language.code))
  profile.languages.push(...clean.languages.filter((language) => !spoken.has(language.code)).slice(0, Math.max(0, P.languages.max - profile.languages.length)))
  await saveProfile(user, profile)
  return { added: { skills: skills.length, workHistory: jobs.length, education: studies.length } }
}
