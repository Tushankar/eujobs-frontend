import { addStandardNames } from '../lib/ai.js'
import { connectDb, disconnectDb } from '../lib/db.js'
import { CandidateProfile } from '../modules/candidates/candidates.model.js'
import { Job } from '../modules/jobs/jobs.model.js'
import { Course } from '../modules/learning/learning.model.js'
import { scheduleRecompute } from '../modules/matching/matching.service.js'

/*
 * node --env-file=.env scripts/standardiseSkills.js (once per database, 2026-11-05): skills saved before standard names
 * existed get OpenAI's `standard` name (lib/ai.js addStandardNames), so "postgrace sql" matches PostgreSQL; the code form
 * (lib/skills.js) already covers "React js" = React without it. Then every match is recomputed on the next scheduler
 * tick of the running server. Safe to rerun: skills with a `standard` are skipped.
 */
const BATCH = 40

await connectDb()
const profiles = await CandidateProfile.find({}, 'skills learningPlan')
const jobs = await Job.find({}, 'requiredSkills preferredSkills')
const courses = await Course.find({}, 'skillTags')
const listsOf = { profile: (doc) => [doc.skills, doc.learningPlan], job: (doc) => [doc.requiredSkills, doc.preferredSkills], course: (doc) => [doc.skillTags] }
const docs = [...profiles.map((doc) => ['profile', doc]), ...jobs.map((doc) => ['job', doc]), ...courses.map((doc) => ['course', doc])]

// One OpenAI request per batch of distinct names fills the cache; each document then reads from it.
const names = [...new Set(docs.flatMap(([type, doc]) => listsOf[type](doc).flat().filter((skill) => !skill.standard).map((skill) => skill.name)))]
for (let index = 0; index < names.length; index += BATCH) await addStandardNames(names.slice(index, index + BATCH).map((name) => ({ name })))

let updated = 0
let unmapped = 0
for (const [type, doc] of docs) {
  const skills = listsOf[type](doc).flat()
  if (!skills.some((skill) => !skill.standard)) continue
  await addStandardNames(skills)
  unmapped += skills.filter((skill) => !skill.standard).length
  await doc.save()
  updated += 1
}
await scheduleRecompute('all')
console.log(`standardise skills: ${names.length} names, ${updated} documents updated, ${unmapped} skills left on the code form (OpenAI unavailable)`)
await disconnectDb()
