import mongoose from 'mongoose'
import { ENUMS } from '../../config/enums.js'

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

export const BlogPost = mongoose.model('BlogPost', blogPostSchema)
