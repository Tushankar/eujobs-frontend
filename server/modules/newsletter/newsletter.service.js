import { createHash, randomBytes } from 'node:crypto'
import { config } from '../../config/env.js'
import { LIMITS } from '../../config/limits.js'
import { AppError } from '../../lib/errors.js'
import { sendEmail } from '../../lib/mailer.js'
import { NewsletterSubscriber } from './newsletter.model.js'

/*
 * The newsletter double opt-in (2026-11-13, EU). Subscribing always answers the same way, so the form never tells
 * whether an address is on the list; a confirmed address gets no new email. There is no newsletter sending yet:
 * admins see and export the confirmed list.
 */
const MINUTE = 60 * 1000
const hash = (token) => createHash('sha256').update(token).digest('hex')

export async function subscribe({ email, language }) {
  const existing = await NewsletterSubscriber.findOne({ email })
  if (existing?.status === 'confirmed') return { ok: true }
  // One confirmation email a minute per address.
  if (existing?.status === 'pending' && Date.now() - existing.tokenSentAt < MINUTE) return { ok: true }

  const token = randomBytes(32).toString('hex')
  await NewsletterSubscriber.findOneAndUpdate(
    { email },
    { $set: { language, status: 'pending', tokenHash: hash(token), tokenSentAt: new Date() }, $unset: { unsubscribedAt: 1 } },
    { upsert: true },
  )
  const link = (action) => `${config.clientOrigin}/newsletter/${action}?token=${token}`
  await sendEmail({ type: 'newsletter_confirm', to: email, language, params: { link: link('confirm'), secondaryLink: link('unsubscribe') } })
  return { ok: true }
}

async function byToken(token) {
  const subscriber = await NewsletterSubscriber.findOne({ tokenHash: hash(token) })
  if (!subscriber) throw new AppError('TOKEN_INVALID')
  return subscriber
}

/** A pending address confirms within the link's lifetime; confirming twice is fine. */
export async function confirm(token) {
  const subscriber = await byToken(token)
  if (subscriber.status === 'unsubscribed') throw new AppError('TOKEN_INVALID')
  if (subscriber.status === 'pending') {
    if (Date.now() - subscriber.tokenSentAt > LIMITS.newsletter.confirmTtlMs) throw new AppError('TOKEN_EXPIRED')
    subscriber.status = 'confirmed'
    subscriber.confirmedAt = new Date()
    await subscriber.save()
  }
  return { status: subscriber.status }
}

export async function unsubscribe(token) {
  const subscriber = await byToken(token)
  if (subscriber.status !== 'unsubscribed') {
    subscriber.status = 'unsubscribed'
    subscriber.unsubscribedAt = new Date()
    await subscriber.save()
  }
  return { status: subscriber.status }
}

const adminDto = (subscriber) => ({
  id: String(subscriber._id),
  email: subscriber.email,
  language: subscriber.language,
  status: subscriber.status,
  createdAt: subscriber.createdAt,
  confirmedAt: subscriber.confirmedAt ?? null,
  unsubscribedAt: subscriber.unsubscribedAt ?? null,
})

/** admin › Website › Subscribers: one status, newest first, with every status's count. */
export async function adminList({ status, page }) {
  const { pageSize } = LIMITS.adminTable
  const [items, total, grouped] = await Promise.all([
    NewsletterSubscriber.find({ status }).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize),
    NewsletterSubscriber.countDocuments({ status }),
    NewsletterSubscriber.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
  ])
  const counts = { pending: 0, confirmed: 0, unsubscribed: 0 }
  for (const { _id, count } of grouped) counts[_id] = count
  return { items: items.map(adminDto), total, page, pageSize, counts }
}

/** The confirmed addresses for the CSV export. */
export async function confirmedRows(headers) {
  const subscribers = await NewsletterSubscriber.find({ status: 'confirmed' }).sort({ confirmedAt: -1 })
  return [headers, ...subscribers.map((subscriber) => [subscriber.email, subscriber.language, subscriber.confirmedAt.toISOString()])]
}
