import { LIMITS } from '../../config/limits.js'
import { AppError, fieldError } from '../../lib/errors.js'
import { skillKey } from '../../lib/skills.js'
import { write } from '../ai/ai.facts.js'
import { PROMPTS } from '../ai/ai.prompts.js'
import { loadProfile, saveProfile } from '../candidates/candidates.service.js'
import { CvVersion } from './cv.model.js'
import { ownVersion } from './cv.service.js'

/*
 * CV AI for Plus candidates (OPENAI_MODEL, U4): a snapshot proposed from the CV text that changes the profile only when
 * the candidate confirms it (M-027, P9-Q3), and assisted drafts of suggestions and a revised snapshot with no new file
 * (M-061), kept until deleted.
 */
const P = LIMITS.profile

/** The model's snapshot within the profile rules: headline length, whole years 0–50, up to 12 unique skills. */
function cleanSnapshot({ role, years, skills }) {
  const seen = new Set()
  return {
    role: role.trim().slice(0, P.headline.max),
    years: Math.min(P.yearsExperience.max, Math.max(P.yearsExperience.min, Math.round(years))),
    skills: skills
      .map((skill) => skill.trim().slice(0, P.skills.itemMax))
      .filter((skill) => skill && !seen.has(skillKey(skill)) && seen.add(skillKey(skill)))
      .slice(0, P.skills.max),
  }
}

async function readableVersion(user, id) {
  const version = await CvVersion.findOne({ _id: (await ownVersion(user, id))._id })
  if (version.noReadableText) throw fieldError({ version: 'no_text' })
  return version
}

/** POST /candidate/cv/versions/:id/snapshot: cached per CV text, so asking again costs nothing. */
export async function proposeSnapshot(user, id) {
  const version = await readableVersion(user, id)
  const proposal = cleanSnapshot(await write(PROMPTS.cvSnapshot, { user, model: 'main', input: { cvText: version.extractedText } }))
  version.pendingSnapshot = { ...proposal, createdAt: new Date() }
  await version.save()
}

/**
 * POST …/snapshot/confirm (P9-Q3): the headline becomes the role, the years are set, and the snapshot skills the profile
 * does not list are added up to the 12-skill limit; existing skills stay.
 */
export async function confirmSnapshot(user, id) {
  const version = await CvVersion.findOne({ _id: (await ownVersion(user, id))._id })
  if (!version.pendingSnapshot) throw new AppError('CONFLICT', { params: { reason: 'no_proposal' } })
  const { role, years, skills } = version.pendingSnapshot
  const profile = await loadProfile(user._id)
  const keys = new Set(profile.skills.map((skill) => skill.key))
  const added = skills.filter((skill) => !keys.has(skillKey(skill))).slice(0, Math.max(0, P.skills.max - profile.skills.length))
  profile.set({ headline: role, yearsExperience: years, skills: [...profile.skills, ...added.map((name) => ({ name, key: skillKey(name) }))] })
  await saveProfile(user, profile)
  version.snapshot = { role, years, skills }
  version.pendingSnapshot = null
  await version.save()
}

/** POST /candidate/cv/drafts { versionId }: a new draft each time (stored, not cached). */
export async function createDraft(user, versionId) {
  const version = await readableVersion(user, versionId)
  const draft = await write(PROMPTS.cvDraft, { user, model: 'main', cache: false, input: { cvText: version.extractedText } })
  version.drafts.push({ suggestions: draft.suggestions, revisedSnapshot: cleanSnapshot(draft.revisedSnapshot), createdAt: new Date() })
  await version.save()
}

export async function deleteDraft(user, draftId) {
  const { modifiedCount } = await CvVersion.updateOne({ userId: user._id, 'drafts._id': draftId }, { $pull: { drafts: { _id: draftId } } })
  if (!modifiedCount) throw new AppError('NOT_FOUND')
}
