import mongoose from 'mongoose'
import { ENUMS } from '../../config/enums.js'
import { rulesSchema } from '../agencies/rules.schema.js'
import { placeSchema } from '../candidates/candidates.model.js'

const { Schema } = mongoose
const { ObjectId } = Schema.Types

/*
 * One Job collection read by every role (M-205). On-site and hybrid jobs have a picked city whose country is
 * the job country; remote jobs have country REMOTE, no city and optional eligible countries (OD2, OQ-6i).
 * Skills keep the typed name; `key` is the lower-cased name (duplicates) and `standard` OpenAI's standard name, which
 * with the code form (lib/skills.js) is what overlap compares (M-034, M-052).
 */
const skill = { _id: false, name: String, key: String, standard: String }

/*
 * 2026-11-20: an agency job's terms (absent on company jobs): the client it is for, whether candidates see the client's
 * name, the dates ("YYYY-MM-DD"), the pay rate (minor units, the job country's currency), hours per week (empty: full
 * time 40, part time 20) and the contract PDF the agency attached.
 */
const agencyTerms = new Schema(
  {
    clientId: { type: ObjectId, ref: 'AgencyClient' },
    showClient: { type: Boolean, default: true },
    startDate: String,
    endDate: String,
    rate: new Schema({ amountMinor: Number, currency: String, period: { type: String, enum: ENUMS.ratePeriod } }, { _id: false }),
    hoursPerWeek: Number,
    // The contract's rules count once confirmed (`confirmedAt`); `aiRules` is what AI proposed.
    contract: new Schema({ fileId: ObjectId, name: String, size: Number, uploadedAt: Date, rules: rulesSchema, aiRules: rulesSchema, aiReadAt: Date, confirmedAt: Date }, { _id: false }),
  },
  { _id: false },
)

const jobSchema = new Schema(
  {
    companyId: { type: ObjectId, ref: 'Company', required: true },
    // null once the recruiter deleted their account (M-189: author anonymised).
    createdBy: { type: ObjectId, ref: 'User' },
    title: String,
    employmentType: { type: String, enum: ENUMS.employmentType },
    // 2026-11-24: the job sector's key (meta Sector): the kind of work.
    sector: String,
    brief: String,
    responsibilities: [String],
    requiredSkills: [skill],
    preferredSkills: [skill],
    experienceYears: Number,
    level: { type: String, enum: ENUMS.jobLevel },
    workPreference: { type: String, enum: ENUMS.workPreference },
    country: String,
    location: placeSchema,
    remoteCountries: [String],
    salary: new Schema({ min: Number, max: Number, currency: String, period: { type: String, enum: ENUMS.salaryPeriod } }, { _id: false }),
    requiredLanguages: [{ _id: false, code: String, minLevel: { type: String, enum: ENUMS.languageLevel } }],
    visaSponsorship: { type: Boolean, default: false },
    status: { type: String, enum: ENUMS.jobStatus, default: 'draft' },
    firstPublishedAt: Date,
    publishedAt: Date,
    closedAt: Date,
    restricted: { reason: String, by: ObjectId, at: Date, caseId: ObjectId },
    relevantCount: { type: Number, default: 0 },
    relevantComputedAt: Date,
    // OD14: when the recruiter was last emailed about new applications to this job.
    applicantsEmailedAt: Date,
    agency: agencyTerms,
  },
  { timestamps: true },
)
jobSchema.index({ status: 1, country: 1 })
jobSchema.index({ companyId: 1, status: 1 })
jobSchema.index({ status: 1, sector: 1 })
jobSchema.index({ 'agency.clientId': 1 }, { sparse: true })

/* M-065 */
const savedJobSchema = new Schema(
  {
    candidateId: { type: ObjectId, ref: 'User', required: true },
    jobId: { type: ObjectId, ref: 'Job', required: true },
  },
  { timestamps: true },
)
savedJobSchema.index({ candidateId: 1, jobId: 1 }, { unique: true })

export const Job = mongoose.model('Job', jobSchema)
export const SavedJob = mongoose.model('SavedJob', savedJobSchema)
