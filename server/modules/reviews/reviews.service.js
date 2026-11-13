import { LIMITS } from '../../config/limits.js'
import { actorFor, recordAudit } from '../../lib/audit.js'
import { AppError } from '../../lib/errors.js'
import { CandidateProfile } from '../candidates/candidates.model.js'
import { Company } from '../companies/companies.model.js'
import { User } from '../users/users.model.js'
import { Review } from './reviews.model.js'

/*
 * Reviews (2026-11-13): the author edits their own one (any change goes back to pending), admins approve or reject
 * it in Moderation, and the landing page shows the newest approved ones of active accounts. The public card shows the
 * first name and last initial ("Priya S.") and a title: the candidate's headline, or the recruiter's job title and
 * company.
 */
const shortName = (fullName = '') => {
  const [first, ...rest] = fullName.trim().split(/\s+/)
  return rest.length ? `${first} ${rest.at(-1)[0].toUpperCase()}.` : first
}

/** Title lines by user id: the candidate headline, or "Job title · Company" for a recruiter. */
async function titles(users) {
  const ids = users.map((user) => user._id)
  const [profiles, companies] = await Promise.all([
    CandidateProfile.find({ userId: { $in: ids } }, 'userId headline'),
    Company.find({ _id: { $in: users.map((user) => user.companyId).filter(Boolean) } }, 'displayName'),
  ])
  const headline = new Map(profiles.map((profile) => [String(profile.userId), profile.headline]))
  const company = new Map(companies.map((entry) => [String(entry._id), entry.displayName]))
  return new Map(
    users.map((user) => {
      const parts = user.role === 'recruiter' ? [user.jobTitle, company.get(String(user.companyId))] : [headline.get(String(user._id))]
      return [String(user._id), parts.filter(Boolean).join(' · ') || null]
    }),
  )
}

const ownDto = (review) =>
  review && {
    id: String(review._id),
    rating: review.rating,
    text: review.text,
    status: review.status,
    submittedAt: review.submittedAt,
    decidedAt: review.decision?.at ?? null,
    reason: review.status === 'rejected' ? (review.decision?.reason ?? null) : null,
  }

export async function getOwn(user) {
  return { review: ownDto(await Review.findOne({ userId: user._id })) }
}

/** Creates or replaces the user's review; it waits for an admin again. */
export async function saveOwn(user, { rating, text }) {
  const review = await Review.findOneAndUpdate(
    { userId: user._id },
    { $set: { rating, text, status: 'pending', submittedAt: new Date() }, $unset: { decision: 1 } },
    { upsert: true, returnDocument: 'after' },
  )
  return { review: ownDto(review) }
}

export async function deleteOwn(user) {
  await Review.deleteOne({ userId: user._id })
  return { review: null }
}

/** The newest approved reviews of active accounts, for the landing page. */
export async function landingReviews() {
  const reviews = await Review.find({ status: 'approved' }).sort({ 'decision.at': -1 }).limit(LIMITS.review.landing * 2)
  const users = await User.find({ _id: { $in: reviews.map((review) => review.userId) }, status: 'active' }, 'fullName role jobTitle companyId')
  const byId = new Map(users.map((user) => [String(user._id), user]))
  const titleOf = await titles(users)
  return reviews
    .filter((review) => byId.has(String(review.userId)))
    .slice(0, LIMITS.review.landing)
    .map((review) => ({
      id: String(review._id),
      rating: review.rating,
      text: review.text,
      name: shortName(byId.get(String(review.userId)).fullName),
      title: titleOf.get(String(review.userId)),
    }))
}

/** Moderation › Reviews: one status, newest first, with the count of every status. */
export async function listForAdmin(status) {
  const [reviews, grouped] = await Promise.all([Review.find({ status }).sort({ submittedAt: -1 }), Review.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }])])
  const users = await User.find({ _id: { $in: reviews.map((review) => review.userId) } }, 'fullName email role jobTitle companyId')
  const byId = new Map(users.map((user) => [String(user._id), user]))
  const titleOf = await titles(users)
  const counts = { pending: 0, approved: 0, rejected: 0 }
  for (const { _id, count } of grouped) counts[_id] = count
  return {
    counts,
    items: reviews.map((review) => {
      const author = byId.get(String(review.userId))
      return {
        ...ownDto(review),
        reason: review.decision?.reason ?? null,
        author: author ? { id: String(author._id), name: author.fullName, email: author.email, role: author.role, title: titleOf.get(String(author._id)) } : null,
      }
    }),
  }
}

/** Approve or reject (with an optional reason shown to the author); audited under Moderation. */
export async function decide(admin, id, { action, reason }) {
  const review = await Review.findById(id)
  if (!review) throw new AppError('NOT_FOUND')
  const status = action === 'approve' ? 'approved' : 'rejected'
  review.status = status
  review.decision = { by: admin._id, at: new Date(), reason: status === 'rejected' ? reason || undefined : undefined }
  await review.save()
  const author = await User.findById(review.userId, 'fullName')
  await recordAudit({
    type: `moderation.review_${status}`,
    category: 'moderation',
    actor: actorFor(admin),
    target: { type: 'review', id: review._id },
    params: { name: author?.fullName ?? null, note: reason || '' },
  })
  return ownDto(review)
}
