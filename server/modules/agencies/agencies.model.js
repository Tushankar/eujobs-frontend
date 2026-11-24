import mongoose from 'mongoose'
import { ENUMS } from '../../config/enums.js'
import { placeSchema } from '../candidates/candidates.model.js'
import { rulesSchema } from './rules.schema.js'

const { Schema } = mongoose
const { ObjectId } = Schema.Types

/*
 * 2026-11-20: an agency's clients, the companies its jobs are for. The agency fills them in itself; a client is not an
 * account. `nameKey` is the normalised name (agencies.service.js clientNameKey) that same-client rules compare when the
 * client is not linked to an EU Jobs company (`linkedCompanyId`).
 */
const agencyClientSchema = new Schema(
  {
    // The agency's own company
    companyId: { type: ObjectId, ref: 'Company', required: true },
    name: { type: String, required: true },
    nameKey: { type: String, required: true },
    // 2026-11-24: as on companies, the sector's key and its English name in `industry`.
    sector: String,
    industry: String,
    location: placeSchema,
    logoFileId: ObjectId,
    linkedCompanyId: { type: ObjectId, ref: 'Company' },
  },
  { timestamps: true },
)
agencyClientSchema.index({ companyId: 1, nameKey: 1 }, { unique: true })

export const AgencyClient = mongoose.model('AgencyClient', agencyClientSchema)

/*
 * 2026-11-20: the agency's agreement with the candidates on its books, in versions. A version starts as a draft (the PDF,
 * its rules proposed by AI or typed) and counts once published, which confirms its rules; the latest published version
 * is current. `aiRules` keeps what AI proposed, so the agency sees what it changed.
 */
const fileRef = new Schema({ fileId: ObjectId, name: String, size: Number }, { _id: false })
const agreementSchema = new Schema(
  {
    companyId: { type: ObjectId, ref: 'Company', required: true },
    version: { type: Number, required: true },
    status: { type: String, enum: ENUMS.agreementStatus, default: 'draft' },
    file: fileRef,
    rules: rulesSchema,
    aiRules: rulesSchema,
    aiReadAt: Date,
    uploadedBy: ObjectId,
    publishedAt: Date,
    publishedBy: ObjectId,
  },
  { timestamps: true },
)
agreementSchema.index({ companyId: 1, version: 1 }, { unique: true })

/*
 * 2026-11-20: a candidate's place on an agency's books. requested (the candidate asked) → awaiting_agreement (the agency
 * accepted, or invited) → active once the candidate agrees to the current agreement; either side can end it; declined
 * and ended can start again. `acceptances` records each agreement version agreed to: the name, the date and the version.
 */
const membershipSchema = new Schema(
  {
    companyId: { type: ObjectId, ref: 'Company', required: true },
    candidateId: { type: ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ENUMS.membershipStatus, required: true },
    requestedBy: { type: String, enum: ['candidate', 'agency'], required: true },
    acceptances: [{ _id: false, version: Number, name: String, at: Date }],
    endedBy: { type: String, enum: ['candidate', 'agency'] },
    history: [{ _id: false, status: { type: String, enum: ENUMS.membershipStatus }, by: { type: String, enum: ['candidate', 'agency'] }, at: Date }],
  },
  { timestamps: true },
)
membershipSchema.index({ companyId: 1, candidateId: 1 }, { unique: true })
membershipSchema.index({ candidateId: 1, status: 1 })

export const AgencyAgreement = mongoose.model('AgencyAgreement', agreementSchema)
export const AgencyMembership = mongoose.model('AgencyMembership', membershipSchema)

/*
 * 2026-11-20: a candidate's assignment through an agency: created confirmed when the agency moves an applicant to Hired
 * on an agency job, or offered (re-hire) and confirmed when the candidate accepts. Dates ("YYYY-MM-DD") come from the
 * job; the candidate's notice (`noticeGivenOn`) or the agency's earlier end (`endedEarlyOn`) can bring the end forward.
 * `rules` is fixed at confirmation: each rule from the job's contract, else the agreement version the candidate agreed
 * to, else the default (overlapping agency jobs are blocked), with `sources` saying which. The client is copied so
 * same-client rules compare the linked company or the normalised name.
 */
const placementSchema = new Schema(
  {
    companyId: { type: ObjectId, ref: 'Company', required: true },
    candidateId: { type: ObjectId, ref: 'User', required: true },
    jobId: { type: ObjectId, ref: 'Job', required: true },
    applicationId: { type: ObjectId, ref: 'Application' },
    // The ended placement a re-hire offer follows
    previousId: ObjectId,
    status: { type: String, enum: ENUMS.placementStatus, required: true },
    client: { _id: false, clientId: ObjectId, name: String, nameKey: String, linkedCompanyId: ObjectId },
    startDate: String,
    endDate: String,
    hoursPerWeek: Number,
    rules: rulesSchema,
    sources: { _id: false, exclusivity: String, noticeDays: String, coolingOffDays: String, maxWeeklyHours: String },
    agreementVersion: Number,
    noticeGivenOn: String,
    endedEarlyOn: String,
    confirmedAt: Date,
    decidedAt: Date,
    // 2026-11-20 (phase 5): the days the candidate was reminded of (start tomorrow, end in 3 days)
    remindedStartOn: { type: String, default: null },
    remindedEndOn: { type: String, default: null },
    // Phase 6 (2026-11-23): the effective end the agency was alerted about (7 days before)
    remindedAgencyEndOn: { type: String, default: null },
  },
  { timestamps: true },
)
placementSchema.index({ candidateId: 1, status: 1 })
placementSchema.index({ companyId: 1, status: 1 })
placementSchema.index({ applicationId: 1 }, { sparse: true })

export const AgencyPlacement = mongoose.model('AgencyPlacement', placementSchema)
