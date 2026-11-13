import { readFile } from 'node:fs/promises'
import { storeFile } from '../lib/files.js'
import { reencodeImage } from '../lib/images.js'
import { renderMarkdown } from '../lib/markdown.js'
import { BlogPost } from '../modules/blog/blog.model.js'
import { Review } from '../modules/reviews/reviews.model.js'
import { User } from '../modules/users/users.model.js'
import { BLOG_POSTS, REVIEWS } from './data/website.js'

/*
 * The public website of seed:demo (owner 2026-11-13): three published blog posts by the Owner with their covers, and
 * six reviews by seeded people, approved by the Owner, as the landing page shows them.
 */
const DAY = 24 * 60 * 60 * 1000

/** Lowercase, accent-free words joined by hyphens (as blog.service.js makes slugs). */
const slugify = (title) =>
  title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

export async function seedWebsite({ owner, now }) {
  for (const { cover, daysAgo, body, ...post } of BLOG_POSTS) {
    const buffer = await reencodeImage(await readFile(new URL(`../../${cover}`, import.meta.url)), 'jpg')
    const file = await storeFile({ ownerId: owner._id, purpose: 'blog_cover', buffer, ext: 'jpg', originalName: cover.split('/').pop() })
    await BlogPost.create({
      ...post,
      slug: slugify(post.title),
      language: 'en',
      bodyMarkdown: body,
      bodyHtml: renderMarkdown(body),
      coverFileId: file._id,
      status: 'published',
      publishedAt: new Date(now - daysAgo * DAY),
      authorId: owner._id,
      updatedBy: owner._id,
    })
  }

  for (const { fullName, rating, text, daysAgo } of REVIEWS) {
    const user = await User.findOne({ fullName, role: { $in: ['candidate', 'recruiter'] }, status: 'active' })
    if (!user) throw new Error(`seed:demo reviews: no active user named ${fullName}`)
    const decidedAt = new Date(now - daysAgo * DAY)
    await Review.create({ userId: user._id, rating, text, status: 'approved', submittedAt: new Date(decidedAt.getTime() - DAY / 2), decision: { by: owner._id, at: decidedAt } })
  }
}
