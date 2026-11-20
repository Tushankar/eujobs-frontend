import { actorFor, recordAudit } from '../../lib/audit.js'
import { AppError } from '../../lib/errors.js'
import { removeFiles, signedUrl, storeFile } from '../../lib/files.js'
import { File } from '../files/files.model.js'
import { AgencyAgreement, AgencyMembership } from './agencies.model.js'
import { checkedRules, EMPTY_RULES, readRules, rulesDto } from './contracts.js'

/*
 * 2026-11-20: Agency › Agreement. One draft at a time (a new version's PDF and rules); publishing confirms its rules and
 * makes it the current version. Candidates on the books agree to the current version; after a new one they agree again
 * before their next placement (the version they agreed to keeps applying until then).
 */

/** The latest published version, or null. */
export const currentAgreement = (companyId) => AgencyAgreement.findOne({ companyId, status: 'published' }).sort({ version: -1 })

const draftOf = (company) => AgencyAgreement.findOne({ companyId: company._id, status: 'draft' })

async function ownDraft(company) {
  const draft = await draftOf(company)
  if (!draft) throw new AppError('NOT_FOUND')
  return draft
}

export function agreementDto(agreement, { viewerId, file } = {}) {
  return {
    version: agreement.version,
    status: agreement.status,
    file: { name: agreement.file.name, size: agreement.file.size, url: file && viewerId ? signedUrl(file, viewerId) : null },
    rules: rulesDto(agreement.rules),
    aiRules: agreement.aiReadAt ? rulesDto(agreement.aiRules) : null,
    aiReadAt: agreement.aiReadAt ?? null,
    publishedAt: agreement.publishedAt ?? null,
    createdAt: agreement.createdAt,
  }
}

/** GET /agency/agreement: the current version (with how many on the books agreed to it), the draft and earlier versions. */
export async function agreementOverview(user, company) {
  const all = await AgencyAgreement.find({ companyId: company._id }).sort({ version: -1 })
  const files = new Map((await File.find({ _id: { $in: all.map((agreement) => agreement.file.fileId) } })).map((file) => [String(file._id), file]))
  const dto = (agreement) => agreement && agreementDto(agreement, { viewerId: user._id, file: files.get(String(agreement.file.fileId)) })
  const published = all.filter((agreement) => agreement.status === 'published')
  const current = published[0] ?? null
  const active = await AgencyMembership.find({ companyId: company._id, status: 'active' }, 'acceptances')
  const agreed = current ? active.filter((membership) => membership.acceptances.some((entry) => entry.version === current.version)).length : 0
  return {
    current: current ? { ...dto(current), agreed, onBooks: active.length } : null,
    draft: dto(all.find((agreement) => agreement.status === 'draft')) ?? null,
    earlier: published.slice(1).map(dto),
  }
}

/** POST /agency/agreement: the PDF of the next version; a draft's earlier PDF is replaced, with its rules. */
export async function uploadDraft(user, company, upload) {
  const file = await storeFile({ ownerId: user._id, purpose: 'agency_agreement', buffer: upload.buffer, ext: upload.ext, originalName: upload.originalname })
  const fields = { file: { fileId: file._id, name: upload.originalname, size: file.size }, rules: EMPTY_RULES, aiRules: undefined, aiReadAt: undefined, uploadedBy: user._id }
  const draft = await draftOf(company)
  if (draft) {
    const previous = draft.file.fileId
    draft.set(fields)
    await draft.save()
    await removeFiles([previous])
    return draft
  }
  const latest = await AgencyAgreement.findOne({ companyId: company._id }).sort({ version: -1 })
  return AgencyAgreement.create({ companyId: company._id, version: (latest?.version ?? 0) + 1, ...fields })
}

/** POST /agency/agreement/draft/read (Agency Plus): AI proposes the draft's rules; they replace the draft's rules. */
export async function readDraft(user, company) {
  const draft = await ownDraft(company)
  const rules = await readRules(user, draft.file.fileId)
  draft.set({ rules, aiRules: rules, aiReadAt: new Date() })
  await draft.save()
  return draft
}

/** PUT /agency/agreement/draft/rules: the agency's rules (typed or corrected). */
export async function saveDraftRules(company, body) {
  const draft = await ownDraft(company)
  draft.rules = await checkedRules(draft.file.fileId, body)
  await draft.save()
  return draft
}

/** POST /agency/agreement/draft/publish: the rules as they stand are confirmed and the version becomes current. */
export async function publishDraft(user, company) {
  const draft = await ownDraft(company)
  draft.set({ status: 'published', publishedAt: new Date(), publishedBy: user._id })
  await draft.save()
  await recordAudit({
    type: 'jobs.agreement_published',
    category: 'jobs',
    actor: actorFor(user),
    target: { type: 'company', id: company._id },
    params: { company: company.displayName, version: draft.version },
  })
  return draft
}

export async function deleteDraft(company) {
  const draft = await ownDraft(company)
  await draft.deleteOne()
  await removeFiles([draft.file.fileId])
}
