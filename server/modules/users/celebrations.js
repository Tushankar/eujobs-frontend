import { User } from './users.model.js'

/*
 * Success moments decided away from the person's screen (owner 2026-11-17): a plan started, a certificate, a paid course,
 * an approved verification or company account, a hire, a complete profile. Each is kept on the user until they see its
 * success modal once, on any device (GET /me lists them, POST /me/celebrations/:id/seen removes one). Moments that
 * happen on their own screen (applying, publishing a job…) are shown by the client directly.
 */
export const CELEBRATION_KINDS = ['plan_started', 'certificate', 'course_purchased', 'verification_approved', 'account_approved', 'hired', 'profile_complete']
const KEEP = 10

/** Queues a success modal for the user (the latest KEEP are kept). Never fails the caller. */
export async function celebrate(userOrId, kind, params = {}) {
  try {
    const userId = userOrId?._id ?? userOrId
    await User.updateOne({ _id: userId }, { $push: { celebrations: { $each: [{ kind, params, at: new Date() }], $slice: -KEEP } } })
  } catch (error) {
    console.error(`Celebration not stored: ${error.message}`)
  }
}

/** POST /me/celebrations/:id/seen */
export const markCelebrationSeen = (user, id) => User.updateOne({ _id: user._id }, { $pull: { celebrations: { _id: id } } })

export const celebrationDtos = (user) => (user.celebrations ?? []).map((item) => ({ id: String(item._id), kind: item.kind, params: item.params ?? {}, at: item.at }))
