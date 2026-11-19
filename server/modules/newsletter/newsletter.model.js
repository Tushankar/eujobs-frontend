import mongoose from 'mongoose'
import { ENUMS } from '../../config/enums.js'

const { Schema } = mongoose

/*
 * Newsletter subscribers (2026-11-13): double opt-in. The emailed token (stored as its SHA-256) confirms the address and
 * later unsubscribes it; a new subscribe issues a new token.
 */
const subscriberSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    language: { type: String, enum: ENUMS.language, default: 'en' },
    status: { type: String, enum: ENUMS.subscriberStatus, default: 'pending' },
    tokenHash: { type: String, required: true, index: true },
    tokenSentAt: { type: Date, required: true },
    // 2026-11-19: stays valid for the unsubscribe link of every issue (the confirm token above is a hash and cannot be mailed again).
    unsubscribeKey: { type: String, index: true },
    confirmedAt: Date,
    unsubscribedAt: Date,
  },
  { timestamps: true },
)

export const NewsletterSubscriber = mongoose.model('NewsletterSubscriber', subscriberSchema)

/*
 * Newsletter issues (2026-11-19). An admin composes a draft in admin › Website › Newsletter: a subject and an intro per
 * language, plus the jobs and blog posts to feature. Sending takes a snapshot of those items, so every batch shows the
 * same content, and goes to the confirmed subscribers in their own language (English where a language has no copy).
 */
const copy = new Schema({ subject: { type: String, default: '' }, intro: { type: String, default: '' } }, { _id: false })
const issueSchema = new Schema(
  {
    translations: Object.fromEntries(ENUMS.language.map((language) => [language, { type: copy, default: () => ({}) }])),
    jobIds: [{ type: Schema.Types.ObjectId, ref: 'Job' }],
    postIds: [{ type: Schema.Types.ObjectId, ref: 'BlogPost' }],
    status: { type: String, enum: ['draft', 'sending', 'sent'], default: 'draft' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    sentBy: { type: Schema.Types.ObjectId, ref: 'User' },
    sentAt: Date,
    finishedAt: Date,
    recipients: { type: Number, default: 0 },
    snapshot: {
      type: new Schema(
        {
          jobs: [{ _id: false, id: String, title: String, company: String, city: String, remote: Boolean }],
          posts: [{ _id: false, slug: String, title: String }],
        },
        { _id: false },
      ),
    },
  },
  { timestamps: true },
)

/** One row per issue and subscriber: the unique pair means a retry or a second task never mails an address twice. */
const deliverySchema = new Schema(
  {
    issueId: { type: Schema.Types.ObjectId, ref: 'NewsletterIssue', required: true },
    subscriberId: { type: Schema.Types.ObjectId, ref: 'NewsletterSubscriber', required: true },
    status: { type: String, enum: ['pending', 'sent', 'failed', 'skipped'], default: 'pending' },
  },
  { timestamps: true },
)
deliverySchema.index({ issueId: 1, subscriberId: 1 }, { unique: true })

export const NewsletterIssue = mongoose.model('NewsletterIssue', issueSchema)
export const NewsletterDelivery = mongoose.model('NewsletterDelivery', deliverySchema)
