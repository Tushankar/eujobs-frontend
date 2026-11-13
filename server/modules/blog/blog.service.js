import { LIMITS } from '../../config/limits.js'
import { actorFor, recordAudit } from '../../lib/audit.js'
import { AppError, fieldError } from '../../lib/errors.js'
import { removeFiles, signedUrl, storeFile } from '../../lib/files.js'
import { reencodeImage } from '../../lib/images.js'
import { renderMarkdown } from '../../lib/markdown.js'
import { File } from '../files/files.model.js'
import { User } from '../users/users.model.js'
import { BlogPost } from './blog.model.js'

/*
 * The blog (2026-11-13). Admins with `content.manage` write posts in admin › Website; publishing needs a cover. The
 * public list shows published posts in the visitor's language, or the English ones when that language has none.
 * Cover links are signed for the cover's owner, since a visitor has no session (as company logos on the landing page).
 */
const slugify = (title) =>
  title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'post'

async function uniqueSlug(title) {
  const base = slugify(title)
  let slug = base
  for (let index = 2; await BlogPost.exists({ slug }); index++) slug = `${base}-${index}`
  return slug
}

async function findPost(id) {
  const post = await BlogPost.findById(id)
  if (!post) throw new AppError('NOT_FOUND')
  return post
}

const audit = (admin, post, type) =>
  recordAudit({ type: `content.${type}`, category: 'content', actor: actorFor(admin), target: { type: 'blog_post', id: post._id }, params: { title: post.title } })

/** Cover URLs and author names for a set of posts. */
async function related(posts) {
  const [files, authors] = await Promise.all([
    File.find({ _id: { $in: posts.map((post) => post.coverFileId).filter(Boolean) } }),
    User.find({ _id: { $in: posts.map((post) => post.authorId) } }, 'fullName'),
  ])
  const fileById = new Map(files.map((file) => [String(file._id), file]))
  const nameById = new Map(authors.map((author) => [String(author._id), author.fullName]))
  return (post) => {
    const file = post.coverFileId && fileById.get(String(post.coverFileId))
    return { coverUrl: file ? signedUrl(file, file.ownerId) : null, author: nameById.get(String(post.authorId)) ?? null }
  }
}

const cardDto = (post, extra) => ({
  id: String(post._id),
  slug: post.slug,
  title: post.title,
  excerpt: post.excerpt,
  language: post.language,
  publishedAt: post.publishedAt ?? null,
  ...extra(post),
})

/* ---------- admin › Website › Blog ---------- */

const adminDto = (post, extra) => ({
  ...cardDto(post, extra),
  status: post.status,
  bodyMarkdown: post.bodyMarkdown,
  coverFileId: post.coverFileId ? String(post.coverFileId) : null,
  updatedAt: post.updatedAt,
})

export async function adminList() {
  const posts = await BlogPost.find().sort({ updatedAt: -1 })
  const extra = await related(posts)
  return { items: posts.map((post) => adminDto(post, extra)), total: posts.length }
}

export async function adminGet(id) {
  const post = await findPost(id)
  return adminDto(post, await related([post]))
}

async function coverId(id) {
  if (!id) return undefined
  const file = await File.findOne({ _id: id, purpose: 'blog_cover' })
  if (!file) throw fieldError({ coverFileId: 'invalid' })
  return file._id
}

export async function create(admin, { title, language, excerpt, bodyMarkdown, coverFileId }) {
  const post = await BlogPost.create({
    title,
    slug: await uniqueSlug(title),
    language,
    excerpt,
    bodyMarkdown,
    bodyHtml: renderMarkdown(bodyMarkdown),
    coverFileId: await coverId(coverFileId),
    authorId: admin._id,
    updatedBy: admin._id,
  })
  await audit(admin, post, 'blog_created')
  return adminGet(post._id)
}

/** Copy and cover stay editable after publishing; a published post keeps its cover. */
export async function update(admin, id, changes) {
  const post = await findPost(id)
  for (const field of ['title', 'language', 'excerpt']) if (changes[field] !== undefined) post[field] = changes[field]
  if (changes.bodyMarkdown !== undefined) {
    post.bodyMarkdown = changes.bodyMarkdown
    post.bodyHtml = renderMarkdown(changes.bodyMarkdown)
  }
  const previousCover = post.coverFileId
  if (changes.coverFileId !== undefined) {
    if (!changes.coverFileId && post.status === 'published') throw fieldError({ coverFileId: 'required' })
    post.coverFileId = await coverId(changes.coverFileId)
  }
  post.updatedBy = admin._id
  await post.save()
  if (previousCover && String(previousCover) !== String(post.coverFileId)) await removeFiles([previousCover])
  await audit(admin, post, 'blog_updated')
  return adminGet(post._id)
}

/** Publishing needs a cover; the first publish sets the date shown on the card. */
export async function setStatus(admin, id, { status }) {
  const post = await findPost(id)
  if (status === 'published' && !post.coverFileId) throw fieldError({ coverFileId: 'required' })
  post.status = status
  if (status === 'published' && !post.publishedAt) post.publishedAt = new Date()
  post.updatedBy = admin._id
  await post.save()
  await audit(admin, post, status === 'published' ? 'blog_published' : 'blog_unpublished')
  return adminGet(post._id)
}

export async function remove(admin, id) {
  const post = await findPost(id)
  await BlogPost.deleteOne({ _id: post._id })
  await removeFiles([post.coverFileId])
  await audit(admin, post, 'blog_deleted')
  return { ok: true }
}

export async function uploadCover(admin, upload) {
  const file = await storeFile({ ownerId: admin._id, purpose: 'blog_cover', ext: upload.ext, originalName: upload.originalname, buffer: await reencodeImage(upload.buffer, upload.ext) })
  return { id: String(file._id), url: signedUrl(file, admin._id) }
}

/* ---------- public ---------- */

/** The visitor's language when it has published posts, else English. */
async function shownLanguage(language) {
  if (language === 'en' || (await BlogPost.exists({ status: 'published', language }))) return language
  return 'en'
}

export async function publicList(language, page = 1) {
  const { pageSize } = LIMITS.blog
  const filter = { status: 'published', language: await shownLanguage(language) }
  const [posts, total] = await Promise.all([
    BlogPost.find(filter).sort({ publishedAt: -1 }).skip((page - 1) * pageSize).limit(pageSize),
    BlogPost.countDocuments(filter),
  ])
  const extra = await related(posts)
  return { items: posts.map((post) => cardDto(post, extra)), total, page, pageSize, language: filter.language }
}

export async function latestPosts(language) {
  const posts = await BlogPost.find({ status: 'published', language: await shownLanguage(language) }).sort({ publishedAt: -1 }).limit(LIMITS.blog.landing)
  const extra = await related(posts)
  return posts.map((post) => cardDto(post, extra))
}

export async function publicPost(slug) {
  const post = await BlogPost.findOne({ slug, status: 'published' })
  if (!post) throw new AppError('NOT_FOUND')
  return { ...cardDto(post, await related([post])), html: post.bodyHtml }
}
