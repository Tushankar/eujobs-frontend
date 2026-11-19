import { config } from '../../config/env.js'
import { ENUMS } from '../../config/enums.js'
import { LIMITS } from '../../config/limits.js'
import { taskHandlers, scheduleTask } from '../../jobs/scheduler.js'
import { actorFor, recordAudit } from '../../lib/audit.js'
import { AppError, fieldError } from '../../lib/errors.js'
import { t } from '../../lib/i18n.js'
import { sendEmail } from '../../lib/mailer.js'
import { renderEmail } from '../../lib/mail/templates.js'
import { BlogPost } from '../blog/blog.model.js'
import { Company } from '../companies/companies.model.js'
import { Job } from '../jobs/jobs.model.js'
import { visibleFilter } from '../jobs/jobs.search.js'
import { NewsletterDelivery, NewsletterIssue, NewsletterSubscriber } from './newsletter.model.js'
import { unsubscribeKeyOf } from './newsletter.service.js'

/*
 * Newsletter issues (2026-11-19, admin › Website › Newsletter). A draft is filled with the newest open jobs and the latest
 * published posts, which the admin can swap, and gets a subject and an intro per language. Only a draft can change. Sending
 * snapshots the items and queues `newsletter.send`, which mails the confirmed subscribers in batches (one batch a tick),
 * each in their own language, with their own unsubscribe link. One delivery row per subscriber keeps a retry from mailing
 * anyone twice; failures are counted and not retried.
 */
const N = LIMITS.newsletterIssue
const SLEEP_MS = 150
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function findIssue(id) {
  const issue = await NewsletterIssue.findById(id)
  if (!issue) throw new AppError('NOT_FOUND')
  return issue
}

const audit = (admin, issue, type, params = {}) =>
  recordAudit({ type: `content.${type}`, category: 'content', actor: actorFor(admin), target: { type: 'newsletter_issue', id: issue._id }, params: { title: issue.translations.en.subject || '—', ...params } })

/* ---------- items ---------- */

const jobItem = (job, company) => ({
  id: String(job._id),
  title: job.title,
  company: company?.displayName ?? '',
  city: job.country === 'REMOTE' ? '' : (job.location?.city ?? ''),
  remote: job.country === 'REMOTE',
})
const postItem = (post) => ({ slug: post.slug, title: post.title })

/** The open jobs among `ids` (a job closed or restricted since is left out), in the given order. */
async function liveJobs(ids) {
  const jobs = await Job.find({ _id: { $in: ids }, ...(await visibleFilter()) })
  const companies = new Map((await Company.find({ _id: { $in: jobs.map((job) => job.companyId) } }, 'displayName')).map((company) => [String(company._id), company]))
  const byId = new Map(jobs.map((job) => [String(job._id), job]))
  return ids.map((id) => byId.get(String(id))).filter(Boolean).map((job) => ({ job, ...jobItem(job, companies.get(String(job.companyId))) }))
}

async function livePosts(ids) {
  const posts = await BlogPost.find({ _id: { $in: ids }, status: 'published' })
  const byId = new Map(posts.map((post) => [String(post._id), post]))
  return ids.map((id) => byId.get(String(id))).filter(Boolean)
}

async function liveSnapshot(issue) {
  const [jobs, posts] = await Promise.all([liveJobs(issue.jobIds), livePosts(issue.postIds)])
  return { jobs: jobs.map(({ job, ...item }) => item), posts: posts.map(postItem) }
}

/* ---------- the email ---------- */

/** What a subscriber in `language` gets: that language's copy, else English. */
function copyFor(issue, language) {
  const own = issue.translations[language]
  const english = issue.translations.en
  return { subject: own.subject.trim() || english.subject.trim(), intro: (own.intro.trim() ? own.intro : english.intro).trim() }
}

function emailParams(issue, snapshot, language, unsubscribeLink) {
  const { subject, intro } = copyFor(issue, language)
  const jobLine = (job) => [job.company, job.remote ? t(language, 'labels.workPreference.remote') : job.city].filter(Boolean).join(' · ')
  return {
    subject,
    paragraphs: intro ? intro.split(/\n{2,}/).map((paragraph) => paragraph.trim()).filter(Boolean) : [],
    sections: [
      snapshot.jobs.length && {
        title: t(language, 'newsletter.jobs'),
        items: snapshot.jobs.map((job) => ({ title: job.title, details: jobLine(job), href: `${config.clientOrigin}/jobs?job=${job.id}` })),
      },
      snapshot.posts.length && {
        title: t(language, 'newsletter.posts'),
        items: snapshot.posts.map((post) => ({ title: post.title, href: `${config.clientOrigin}/blog/${post.slug}` })),
      },
    ].filter(Boolean),
    link: `${config.clientOrigin}/jobs`,
    secondaryLink: unsubscribeLink,
  }
}

/* ---------- admin ---------- */

const adminDto = (issue, extra = {}) => ({
  id: String(issue._id),
  status: issue.status,
  translations: Object.fromEntries(ENUMS.language.map((language) => [language, { subject: issue.translations[language].subject, intro: issue.translations[language].intro }])),
  jobIds: issue.jobIds.map(String),
  postIds: issue.postIds.map(String),
  recipients: issue.recipients,
  sentAt: issue.sentAt ?? null,
  finishedAt: issue.finishedAt ?? null,
  createdAt: issue.createdAt,
  updatedAt: issue.updatedAt,
  ...extra,
})

async function deliveryCounts(issue) {
  const grouped = await NewsletterDelivery.aggregate([{ $match: { issueId: issue._id } }, { $group: { _id: '$status', count: { $sum: 1 } } }])
  const counts = { sent: 0, failed: 0, skipped: 0, pending: 0 }
  for (const { _id, count } of grouped) counts[_id] = count
  return counts
}

export async function list() {
  const issues = await NewsletterIssue.find().sort({ createdAt: -1 }).limit(100)
  const counts = await Promise.all(issues.map(deliveryCounts))
  return { items: issues.map((issue, index) => adminDto(issue, { deliveries: counts[index] })), total: issues.length }
}

export async function get(id) {
  const issue = await findIssue(id)
  const snapshot = issue.status === 'draft' ? await liveSnapshot(issue) : issue.snapshot
  return adminDto(issue, {
    jobs: snapshot.jobs.map((job) => ({ id: job.id, title: job.title, company: job.company, city: job.city, remote: job.remote })),
    posts: snapshot.posts.map((post) => ({ slug: post.slug, title: post.title })),
    deliveries: await deliveryCounts(issue),
    confirmed: await NewsletterSubscriber.countDocuments({ status: 'confirmed' }),
    newSubscribers: issue.status === 'sent' ? await countNew(issue) : 0,
  })
}

/** Confirmed subscribers this issue was never sent to (they confirmed after it went out). */
async function countNew(issue) {
  const done = await NewsletterDelivery.find({ issueId: issue._id }, 'subscriberId')
  return NewsletterSubscriber.countDocuments({ status: 'confirmed', _id: { $nin: done.map((row) => row.subscriberId) } })
}

/** The newest open jobs and published posts a draft can pick from. */
export async function options() {
  const [jobs, posts] = await Promise.all([
    Job.find(await visibleFilter()).sort({ firstPublishedAt: -1 }).limit(N.optionJobs),
    BlogPost.find({ status: 'published' }).sort({ publishedAt: -1 }).limit(N.optionPosts),
  ])
  const companies = new Map((await Company.find({ _id: { $in: jobs.map((job) => job.companyId) } }, 'displayName')).map((company) => [String(company._id), company]))
  return {
    jobs: jobs.map((job) => jobItem(job, companies.get(String(job.companyId)))),
    posts: posts.map((post) => ({ id: String(post._id), slug: post.slug, title: post.title, language: post.language, publishedAt: post.publishedAt })),
  }
}

/** A new draft: the newest open jobs and latest posts, and the standard subject in each language. */
export async function create(admin) {
  const [jobs, posts] = await Promise.all([
    Job.find(await visibleFilter()).sort({ firstPublishedAt: -1 }).limit(N.defaultJobs),
    BlogPost.find({ status: 'published' }).sort({ publishedAt: -1 }).limit(N.defaultPosts),
  ])
  const issue = await NewsletterIssue.create({
    createdBy: admin._id,
    jobIds: jobs.map((job) => job._id),
    postIds: posts.map((post) => post._id),
    translations: Object.fromEntries(ENUMS.language.map((language) => [language, { subject: t(language, 'newsletter.subject'), intro: '' }])),
  })
  await audit(admin, issue, 'newsletter_created')
  return get(issue._id)
}

function requireDraft(issue) {
  if (issue.status !== 'draft') throw new AppError('LOCKED')
}

async function checkIds(Model, ids, filter) {
  const unique = [...new Set(ids)]
  if (unique.length !== ids.length || (await Model.countDocuments({ _id: { $in: unique }, ...filter })) !== unique.length) throw fieldError({ [Model === Job ? 'jobIds' : 'postIds']: 'invalid' })
}

export async function update(admin, id, changes) {
  const issue = await findIssue(id)
  requireDraft(issue)
  if (changes.jobIds) {
    await checkIds(Job, changes.jobIds, await visibleFilter())
    issue.jobIds = changes.jobIds
  }
  if (changes.postIds) {
    await checkIds(BlogPost, changes.postIds, { status: 'published' })
    issue.postIds = changes.postIds
  }
  for (const [language, copy] of Object.entries(changes.translations ?? {})) {
    for (const field of ['subject', 'intro']) if (copy[field] !== undefined) issue.translations[language][field] = copy[field]
  }
  await issue.save()
  return get(issue._id)
}

export async function remove(admin, id) {
  const issue = await findIssue(id)
  requireDraft(issue)
  await NewsletterIssue.deleteOne({ _id: issue._id })
  await audit(admin, issue, 'newsletter_deleted')
  return { ok: true }
}

/** Needs an English subject (the fallback for every language) and at least one item. */
async function readyToSend(issue) {
  const snapshot = await liveSnapshot(issue)
  const fields = {}
  if (!issue.translations.en.subject.trim()) fields.subject = 'required'
  if (!snapshot.jobs.length && !snapshot.posts.length) fields.items = 'required'
  if (Object.keys(fields).length) throw fieldError(fields)
  return snapshot
}

export async function preview(id, language) {
  const issue = await findIssue(id)
  const snapshot = issue.status === 'draft' ? await liveSnapshot(issue) : issue.snapshot
  const { subject, html } = renderEmail('newsletter_issue', language, emailParams(issue, snapshot, language, `${config.clientOrigin}/newsletter/unsubscribe`))
  return { subject, html }
}

/** To the admin's own address, with an unsubscribe link that does nothing. */
export async function sendTest(admin, id, language) {
  const issue = await findIssue(id)
  const snapshot = issue.status === 'draft' ? await liveSnapshot(issue) : issue.snapshot
  const status = await sendEmail({ type: 'newsletter_issue', to: admin.email, userId: admin._id, language, params: emailParams(issue, snapshot, language, `${config.clientOrigin}/newsletter/unsubscribe`) })
  return { status }
}

export async function send(admin, id) {
  const issue = await findIssue(id)
  requireDraft(issue)
  const snapshot = await readyToSend(issue)
  const recipients = await NewsletterSubscriber.countDocuments({ status: 'confirmed' })
  if (!recipients) throw fieldError({ recipients: 'required' })
  // The status flips first and only from draft, so two clicks queue one send.
  const claimed = await NewsletterIssue.findOneAndUpdate(
    { _id: issue._id, status: 'draft' },
    { $set: { status: 'sending', snapshot, recipients, sentBy: admin._id, sentAt: new Date() } },
    { returnDocument: 'after' },
  )
  if (!claimed) throw new AppError('LOCKED')
  await scheduleTask({ type: 'newsletter.send', key: `newsletter:${issue._id}`, dueAt: new Date(), payload: { issueId: String(issue._id) } })
  await audit(admin, claimed, 'newsletter_sent', { count: recipients })
  return get(issue._id)
}

/** A sent issue goes once more, to the subscribers who confirmed after it went out; the earlier recipients are not mailed again. */
export async function sendToNew(admin, id) {
  const issue = await findIssue(id)
  if (issue.status !== 'sent') throw new AppError('LOCKED')
  const fresh = await countNew(issue)
  if (!fresh) throw fieldError({ recipients: 'required' })
  const total = await NewsletterDelivery.countDocuments({ issueId: issue._id })
  const claimed = await NewsletterIssue.findOneAndUpdate(
    { _id: issue._id, status: 'sent' },
    { $set: { status: 'sending', recipients: total + fresh }, $unset: { finishedAt: 1 } },
    { returnDocument: 'after' },
  )
  if (!claimed) throw new AppError('LOCKED')
  await scheduleTask({ type: 'newsletter.send', key: `newsletter:${issue._id}`, dueAt: new Date(), payload: { issueId: String(issue._id) } })
  await audit(admin, claimed, 'newsletter_sent_new', { count: fresh })
  return get(issue._id)
}

/* ---------- delivery ---------- */

/** One batch: the next confirmed subscribers without a delivery row; queues the next batch, or closes the issue. */
async function sendBatch({ issueId }, task, now) {
  const issue = await NewsletterIssue.findById(issueId)
  if (issue?.status !== 'sending') return
  const done = await NewsletterDelivery.find({ issueId: issue._id }, 'subscriberId')
  const batch = await NewsletterSubscriber.find({ status: 'confirmed', _id: { $nin: done.map((row) => row.subscriberId) } }).sort({ _id: 1 }).limit(N.batchSize)
  for (const subscriber of batch) {
    try {
      await NewsletterDelivery.create({ issueId: issue._id, subscriberId: subscriber._id })
    } catch (error) {
      if (error.code === 11000) continue
      throw error
    }
    const key = await unsubscribeKeyOf(subscriber)
    const status = await sendEmail({
      type: 'newsletter_issue',
      to: subscriber.email,
      language: subscriber.language,
      params: emailParams(issue, issue.snapshot, subscriber.language, `${config.clientOrigin}/newsletter/unsubscribe?token=${key}`),
    })
    await NewsletterDelivery.updateOne({ issueId: issue._id, subscriberId: subscriber._id }, { status: status === 'sent' ? 'sent' : status === 'failed' ? 'failed' : 'skipped' })
    if (!config.isTest) await sleep(SLEEP_MS)
  }
  if (batch.length === N.batchSize) {
    await scheduleTask({ type: 'newsletter.send', key: `newsletter:${issue._id}`, dueAt: new Date(now.getTime() + N.batchPauseMs), payload: { issueId: String(issue._id) } })
  } else {
    await NewsletterIssue.updateOne({ _id: issue._id }, { status: 'sent', finishedAt: new Date() })
  }
}

taskHandlers['newsletter.send'] = sendBatch
