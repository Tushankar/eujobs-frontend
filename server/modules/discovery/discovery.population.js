import { CandidateProfile } from '../candidates/candidates.model.js'
import { User } from '../users/users.model.js'

/*
 * Who recruiters can discover (M-054, M-055, M-187, OQ-6a, U27). Shared by Find candidates, the shortlist,
 * the relevant counts and the talent cards. Data sets are small (P13), so filtering runs in Node.
 */
const today = () => new Date().toISOString().slice(0, 10)

/** U27: citizen/settled, or a permit that has not expired. */
export function validRightToWork(entry, on = today()) {
  return entry.status === 'citizen_settled' || (entry.status === 'visa_permit' && Boolean(entry.permitExpiresOn) && entry.permitExpiresOn >= on)
}

// Right-to-work entries are per region (M-021): GB is the UK, every other country is in the EU.
const regionOf = (countryCode) => (countryCode === 'GB' ? 'uk' : 'eu')

/** OD4: "Has right to work in {country}". */
export function hasRightToWorkIn(profile, countryCode, on = today()) {
  return profile.rightToWork.some((entry) => entry.region === regionOf(countryCode) && validRightToWork(entry, on))
}

/** M-055: lives in the country or has the right to work there; Remote = work preference remote (OQ-6a). */
export function inMarket(profile, country) {
  if (country === 'REMOTE') return profile.workPreference === 'remote'
  return profile.location?.countryCode === country || hasRightToWorkIn(profile, country)
}

const LISTABLE_USER = { role: 'candidate', status: 'active', emailVerifiedAt: { $ne: null }, 'privacy.discoverable': true, 'privacy.matchingConsent': true }

/**
 * M-054, P4-D11: candidates listable in some country: email verified, discoverable, consenting, complete and
 * not restricted by moderation (M-167). Returns [{ user, profile }]; `ids` narrows the search.
 */
export async function listableCandidates(ids) {
  const users = await User.find({ ...LISTABLE_USER, ...(ids && { _id: { $in: ids } }) })
  const profiles = await CandidateProfile.find({ userId: { $in: users.map((user) => user._id) }, 'completeness.complete': true, 'restricted.at': null })
  const byUser = new Map(users.map((user) => [String(user._id), user]))
  return profiles.map((profile) => ({ user: byUser.get(String(profile.userId)), profile }))
}

/** The listable candidates in one market (the picker country or a job's country). */
export async function marketCandidates(country) {
  return (await listableCandidates()).filter(({ profile }) => inMarket(profile, country))
}
