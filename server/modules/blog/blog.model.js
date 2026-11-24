import mongoose from 'mongoose'
import { ENUMS } from '../../config/enums.js'
import { trackWrites } from '../../lib/writeVersions.js'

const { Schema } = mongoose

/*
 * Blog posts of the public website (2026-11-13), written by admins in admin › Website. One language per post; the
 * Markdown is kept with its sanitised HTML (as text lessons, M-102). The slug is made from the title at creation.
 */
const blogPostSchema = new Schema(
  {
    title: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    language: { type: String, enum: ENUMS.language, required: true },
    excerpt: { type: String, required: true },
    bodyMarkdown: { type: String, required: true },
    bodyHtml: { type: String, required: true },
    coverFileId: { type: Schema.Types.ObjectId, ref: 'File' },
    status: { type: String, enum: ENUMS.blogStatus, default: 'draft' },
    publishedAt: Date,
    authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
)
blogPostSchema.index({ status: 1, language: 1, publishedAt: -1 })

// Public caches read again after a write (perf 2026-11-24).
trackWrites(blogPostSchema, 'BlogPost')
export const BlogPost = mongoose.model('BlogPost', blogPostSchema)
