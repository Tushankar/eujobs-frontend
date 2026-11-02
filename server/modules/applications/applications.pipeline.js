import { LIMITS } from '../../config/limits.js'
import { AppError, fieldError } from '../../lib/errors.js'
import { ACTIVE_FILTER, Application, PipelineStage } from './applications.model.js'

/*
 * Manage stages (§3.4, M-069 … M-072, OD5): 2 to 12 stages per company, names 1 to 24 characters and unique
 * without regard to case, the first stage ("Applied") never removed or moved, no removal while active
 * applications sit in a stage. Each stage has one of 6 categories; a new custom stage defaults to screening (M-070).
 */
const { stages: STAGES } = LIMITS.pipeline
const TONE_OF_CATEGORY = { applied: 'neutral', screening: 'primary', shortlisted: 'primary', interview: 'primary', offer: 'success', hired: 'success' }

const nameKey = (name, language) => name.toLocaleLowerCase(language)

const stageDto = (stage, activeCount) => ({
  id: String(stage._id),
  name: stage.name,
  category: stage.category,
  tone: stage.tone,
  order: stage.order,
  isEntry: stage.isEntry,
  activeCount,
})

async function ordered(company) {
  return PipelineStage.find({ companyId: company._id }).sort({ order: 1 })
}

/** GET /recruiter/pipeline: the stages in order with the number of active applications in each. */
export async function listStages(company) {
  const [stages, counts] = await Promise.all([
    ordered(company),
    Application.aggregate([{ $match: { companyId: company._id, ...ACTIVE_FILTER } }, { $group: { _id: '$stageId', count: { $sum: 1 } } }]),
  ])
  const countOf = new Map(counts.map((entry) => [String(entry._id), entry.count]))
  const items = stages.map((stage) => stageDto(stage, countOf.get(String(stage._id)) ?? 0))
  return { items, total: items.length, page: 1, pageSize: items.length, limits: { min: STAGES.min, max: STAGES.max } }
}

async function assertNameFree(company, name, language, exceptId) {
  const key = nameKey(name, language)
  if (await PipelineStage.exists({ companyId: company._id, nameKey: key, ...(exceptId && { _id: { $ne: exceptId } }) })) {
    throw fieldError({ name: 'duplicate' })
  }
  return key
}

export async function addStage(user, company, { name, category = 'screening' }) {
  const stages = await ordered(company)
  if (stages.length >= STAGES.max) throw fieldError({ stages: 'too_many' }, { max: STAGES.max })
  const key = await assertNameFree(company, name, user.language)
  await PipelineStage.create({ companyId: company._id, name, nameKey: key, category, tone: TONE_OF_CATEGORY[category], order: stages.length })
  return listStages(company)
}

async function ownStage(company, id) {
  const stage = await PipelineStage.findOne({ _id: id, companyId: company._id })
  if (!stage) throw new AppError('NOT_FOUND')
  return stage
}

/** Rename and/or change the category; the first stage keeps the `applied` category (M-072, OD5). */
export async function updateStage(user, company, id, { name, category }) {
  const stage = await ownStage(company, id)
  if (name !== undefined) {
    stage.nameKey = await assertNameFree(company, name, user.language, stage._id)
    stage.name = name
  }
  if (category !== undefined) {
    if (stage.isEntry && category !== stage.category) throw fieldError({ category: 'not_allowed' })
    stage.category = category
    stage.tone = TONE_OF_CATEGORY[category]
  }
  await stage.save()
  return listStages(company)
}

export async function removeStage(company, id) {
  const stage = await ownStage(company, id)
  if (stage.isEntry) throw new AppError('CONFLICT', { params: { reason: 'entry' } })
  if ((await PipelineStage.countDocuments({ companyId: company._id })) <= STAGES.min) throw fieldError({ stages: 'too_few' }, { min: STAGES.min })
  const active = await Application.countDocuments({ companyId: company._id, stageId: stage._id, ...ACTIVE_FILTER })
  if (active > 0) throw new AppError('IN_USE', { params: { count: active } })
  await stage.deleteOne()
  const rest = await ordered(company)
  await PipelineStage.bulkWrite(rest.map((item, order) => ({ updateOne: { filter: { _id: item._id }, update: { order } } })))
  return listStages(company)
}

/** PUT /recruiter/pipeline/stages/order: every stage id once, the first stage still first (M-072). */
export async function reorderStages(company, ids) {
  const stages = await ordered(company)
  const same = ids.length === stages.length && stages.every((stage) => ids.includes(String(stage._id)))
  if (!same || String(stages.find((stage) => stage.isEntry)._id) !== ids[0]) throw fieldError({ ids: 'invalid' })
  await PipelineStage.bulkWrite(ids.map((id, order) => ({ updateOne: { filter: { _id: id }, update: { order } } })))
  return listStages(company)
}
