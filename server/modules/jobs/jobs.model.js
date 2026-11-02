import mongoose from 'mongoose'
import { ENUMS } from '../../config/enums.js'
import { placeSchema } from '../candidates/candidates.model.js'

const { Schema } = mongoose
const { ObjectId } = Schema.Types

/*
 * One Job collection read by every role (M-205). On-site and hybrid jobs have a picked city whose country is
 * the job country; remote jobs have country REMOTE, no city and optional eligible countries (OD2, OQ-6i).
 * Skills keep the typed name; `key` is the lower-cased name used for overlap (M-034, M-052).
 */
const skill = { _id: false, name: String, key: String }

const jobSchema = new Schema(
  {
    companyId: { type: ObjectId, ref: 'Company', required: true },
    createdBy: { type: ObjectId, ref: 'User', required: true },
    title: String,
    employmentType: { type: String, enum: ENUMS.employmentType },
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
  },
  { timestamps: true },
)
jobSchema.index({ status: 1, country: 1 })
jobSchema.index({ companyId: 1, status: 1 })

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
