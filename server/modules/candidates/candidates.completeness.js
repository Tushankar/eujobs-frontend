/*
 * The completeness checklist (§3.2, M-015, M-016, M-023): one pure function used by /me, the apply gate,
 * discovery, the promo card and every checklist UI. Each counted item weighs the same; N is 10 to 12.
 */
const PROFILE = '/candidate/profile'
const VERIFICATION = '/candidate/verification'

export const ITEM_ROUTES = {
  basics: PROFILE,
  work_history: PROFILE,
  education: PROFILE,
  languages: PROFILE,
  right_to_work: PROFILE,
  photo: PROFILE,
  links: PROFILE,
  live_cv: '/candidate/cv-versions',
  phone: VERIFICATION,
  check_identity: VERIFICATION,
  check_academic: VERIFICATION,
  check_employment: VERIFICATION,
}

/**
 * `approved` holds the categories with a counted approval (approved and not reset, U27).
 * Returns { complete, done, total, percent, items: [{ key, done, route }] } in checklist order.
 */
export function computeCompleteness({ user, profile, approved }) {
  const p = profile
  const done = {
    // M-017: the minimum salary is not part of it.
    basics: Boolean(user.fullName && p.headline && p.location?.placeId && p.about && p.yearsExperience != null && p.skills?.length && p.workPreference),
    work_history: p.workHistory.length > 0 || p.noWorkExperience,
    education: p.education.length > 0 || p.noFormalQualification,
    languages: p.languages.length > 0,
    right_to_work: p.rightToWork.length > 0,
    photo: Boolean(p.photo?.fileId),
    links: Boolean(p.links?.linkedin || p.links?.portfolio),
    live_cv: Boolean(p.liveCvVersionId),
    phone: Boolean(user.phone?.verifiedAt),
    check_identity: approved.has('identity'),
  }
  // M-023: academic and employment checks count only when such an entry exists.
  if (p.education.length > 0) done.check_academic = approved.has('academic')
  if (p.workHistory.length > 0) done.check_employment = approved.has('employment')

  const items = Object.entries(done).map(([key, isDone]) => ({ key, done: Boolean(isDone), route: ITEM_ROUTES[key] }))
  const doneCount = items.filter((item) => item.done).length
  return {
    complete: doneCount === items.length,
    done: doneCount,
    total: items.length,
    percent: Math.round((doneCount / items.length) * 100),
    items,
  }
}
