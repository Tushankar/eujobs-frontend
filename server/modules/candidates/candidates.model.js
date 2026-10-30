import mongoose from 'mongoose'
import { ENUMS } from '../../config/enums.js'

const { Schema } = mongoose
const { ObjectId } = Schema.Types

/* A city picked through the Places proxy (G-1): never coordinates. */
export const placeSchema = new Schema({ countryCode: String, city: String, placeId: String }, { _id: false })

/*
 * The candidate profile (§3.2, M-012 … M-026). Months are "YYYY-MM", dates "YYYY-MM-DD" (§2.3).
 * Entries keep their _id so verification submissions can link to them (M-166, U27).
 * `completeness` is recomputed on every change (§3.2) so discovery can query it.
 */
const profileSchema = new Schema(
  {
    userId: { type: ObjectId, ref: 'User', required: true, unique: true },
    headline: String,
    location: placeSchema,
    about: String,
    yearsExperience: Number,
    skills: [{ _id: false, name: String, key: String }],
    workPreference: { type: String, enum: ENUMS.workPreference },
    availability: { type: String, enum: ENUMS.availability, default: 'open_to_opportunities' },
    salaryMin: new Schema({ amount: Number, currency: String, period: { type: String, enum: ENUMS.salaryPeriod } }, { _id: false }),
    workHistory: [{ title: String, employer: String, start: String, end: String, current: Boolean, description: String }],
    noWorkExperience: { type: Boolean, default: false },
    education: [{ institution: String, degree: String, start: String, end: String, stillStudying: Boolean }],
    noFormalQualification: { type: Boolean, default: false },
    languages: [{ _id: false, code: String, level: { type: String, enum: ENUMS.languageLevel } }],
    rightToWork: [
      { region: { type: String, enum: ENUMS.rtwRegion }, status: { type: String, enum: ENUMS.rtwStatus }, permitExpiresOn: String },
    ],
    links: { linkedin: String, portfolio: String },
    photo: { fileId: ObjectId, smallFileId: ObjectId },
    certificates: [{ name: String, issuer: String, issuedOn: String, expiresOn: String, url: String, fileId: ObjectId }],
    liveCvVersionId: ObjectId,
    completeness: { done: Number, total: Number, complete: { type: Boolean, default: false }, missing: [String] },
    restricted: { reason: String, by: ObjectId, at: Date, caseId: ObjectId },
  },
  { timestamps: true },
)
profileSchema.index({ 'location.countryCode': 1 })

export const CandidateProfile = mongoose.model('CandidateProfile', profileSchema)
