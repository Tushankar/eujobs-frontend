import mongoose from 'mongoose'
import { ENUMS } from '../../config/enums.js'

const { Schema } = mongoose
const localized = { en: String, es: String, fr: String }

/* Every country (worldwide since 2026-11-16, EU 27 + GB first) and REMOTE (M-139). Names come from Intl.DisplayNames on the client. */
const countrySchema = new Schema(
  {
    code: { type: String, required: true, unique: true },
    currency: { type: String, required: true },
    defaultLanguage: { type: String, enum: ENUMS.language, required: true },
    isRemote: { type: Boolean, default: false },
    // The EU 27 (owner 2026-11-16): with GB they come first in every list. No default: rows seeded before then have
    // none, and the client counts those (all EU + UK) as the first group.
    isEu: Boolean,
    order: { type: Number, required: true },
    enabled: { type: Boolean, default: true },
  },
  { timestamps: true },
)

/* Versioned legal texts per language (M-191, OD12). */
const legalDocumentSchema = new Schema(
  {
    doc: { type: String, enum: ENUMS.legalDoc, required: true },
    version: { type: String, required: true },
    language: { type: String, enum: ENUMS.language, required: true },
    title: { type: String, required: true },
    bodyMarkdown: String,
    bodyHtml: String,
    isDraft: { type: Boolean, default: false },
    publishedAt: Date,
  },
  { timestamps: true },
)
legalDocumentSchema.index({ doc: 1, version: 1, language: 1 }, { unique: true })

/* FAQs per audience (M-200). */
const faqSchema = new Schema(
  {
    audiences: [{ type: String, enum: ENUMS.faqAudience }],
    order: { type: Number, required: true },
    question: localized,
    answer: localized,
  },
  { timestamps: true },
)
faqSchema.index({ audiences: 1, order: 1 })

/*
 * 2026-11-24: job sectors (the kind of work). Jobs, companies and agency clients keep the permanent `key`; admins
 * rename and hide sectors (a hidden one stays on what already has it but is not offered any more).
 */
const sectorSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    name: { en: { type: String, required: true }, es: { type: String, required: true }, fr: { type: String, required: true } },
    hidden: { type: Boolean, default: false },
  },
  { timestamps: true },
)

export const Country = mongoose.model('Country', countrySchema)
export const Sector = mongoose.model('Sector', sectorSchema)
export const LegalDocument = mongoose.model('LegalDocument', legalDocumentSchema)
export const Faq = mongoose.model('Faq', faqSchema)
