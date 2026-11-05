import { LIMITS } from '../../config/limits.js'
import { skillId, skillSet } from '../../lib/skills.js'
import { Application, PipelineStage } from '../applications/applications.model.js'
import { CandidateProfile } from '../candidates/candidates.model.js'
import { Job, SavedJob } from '../jobs/jobs.model.js'
import { recommendedJobs } from '../jobs/jobs.search.js'
import { Course, Enrollment } from './learning.model.js'
import { courseCards } from './learning.service.js'

/*
 * "Suggested for you" (M-114, OQ-3): rule-based, for Free and Plus alike, never AI.
 * - Candidates: gap skills = required skills missing from the profile across saved jobs, applied jobs and the first
 *   10 For-you jobs; published candidate courses not enrolled, ranked by how many gap skills their tags match. The
 *   learning-plan skills count as gap skills too (P9-Q2).
 * - Recruiters: up to 3 published recruiter courses not enrolled whose pipeline category holds the most active
 *   applications at the company ("{n} active applications at {stage}"); a category with none is not suggested.
 */
const S = LIMITS.suggestions
const ACTIVE = { $nin: ['withdrawn', 'not_selected'] }

const availableCourses = async (user, filter = {}) => {
  const enrolled = (await Enrollment.find({ userId: user._id }, 'courseId')).map((enrollment) => enrollment.courseId)
  return Course.find({ audience: user.role, status: 'published', _id: { $nin: enrolled }, ...filter })
}

/** The candidate's gap skills, most demanded first, as [{ key, name, jobs }]. */
async function gapSkills(user) {
  const [profile, saved, applied, forYou] = await Promise.all([
    CandidateProfile.findOne({ userId: user._id }, 'skills'),
    SavedJob.find({ candidateId: user._id }, 'jobId'),
    Application.find({ candidateId: user._id }, 'jobId'),
    recommendedJobs(user),
  ])
  const ids = [...saved, ...applied].map((entry) => String(entry.jobId)).concat(forYou.items.slice(0, S.forYouJobs).map((job) => job.id))
  const jobs = await Job.find({ _id: { $in: [...new Set(ids)] } }, 'requiredSkills')
  const have = skillSet(profile?.skills)
  const gaps = new Map()
  for (const skill of jobs.flatMap((job) => job.requiredSkills).filter((skill) => !have.has(skill))) {
    const id = skillId(skill)
    const gap = gaps.get(id) ?? { name: skill.name, standard: skill.standard, jobs: 0 }
    gaps.set(id, { ...gap, jobs: gap.jobs + 1 })
  }
  return [...gaps.values()].sort((a, b) => b.jobs - a.jobs || a.name.localeCompare(b.name))
}

async function candidateSuggestions(user) {
  const [gaps, profile] = await Promise.all([gapSkills(user), CandidateProfile.findOne({ userId: user._id }, 'learningPlan')])
  const plan = profile?.learningPlan ?? []
  const wanted = skillSet([...gaps, ...plan])
  const ranked = (await availableCourses(user))
    .map((course) => ({ course, matched: course.skillTags.filter((tag) => wanted.has(tag)).map((tag) => tag.name) }))
    .filter((entry) => entry.matched.length > 0)
    .sort((a, b) => b.matched.length - a.matched.length || a.course.title.localeCompare(b.course.title))
  const cards = await courseCards(user, ranked.map((entry) => entry.course))
  return {
    gapSkills: gaps.map((gap) => gap.name),
    planSkills: plan.filter((skill) => !skillSet(gaps).has(skill)).map((skill) => skill.name),
    items: cards.map((card, index) => ({ ...card, matchedSkills: ranked[index].matched })),
  }
}

async function recruiterSuggestions(user) {
  const applications = await Application.find({ companyId: user.companyId, status: ACTIVE }, 'stageId')
  const stages = new Map((await PipelineStage.find({ _id: { $in: applications.map((application) => application.stageId) } }, 'category')).map((stage) => [String(stage._id), stage.category]))
  const counts = new Map()
  for (const application of applications) {
    const category = stages.get(String(application.stageId))
    if (category) counts.set(category, (counts.get(category) ?? 0) + 1)
  }
  const ranked = (await availableCourses(user, { pipelineCategory: { $in: [...counts.keys()] } }))
    .sort((a, b) => counts.get(b.pipelineCategory) - counts.get(a.pipelineCategory) || a.title.localeCompare(b.title))
    .slice(0, S.recruiterCourses)
  const cards = await courseCards(user, ranked)
  return { items: cards.map((card, index) => ({ ...card, reason: { count: counts.get(ranked[index].pipelineCategory), stage: ranked[index].pipelineCategory } })) }
}

/** GET /learning/suggestions */
export function suggestions(user) {
  return user.role === 'candidate' ? candidateSuggestions(user) : recruiterSuggestions(user)
}
