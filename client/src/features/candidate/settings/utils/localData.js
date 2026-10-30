import { CV_STORAGE_KEY, EMPTY_CV } from '../../cv/data/cvVersions.js'
import { LEARNING_STORAGE_KEY } from '../../learning/data/courses.js'
import { PROFILE_STORAGE_KEY } from '../../profile/data/profile.js'
import { experienceLabel, salaryLabel } from '../../profile/utils/profileText.js'
import { CREDENTIAL_CHECKS } from '../../verification/data/verification.js'

/** Everything this demo keeps on the device lives under `lwm.`; candidate data under `lwm.candidate.`. */
const STORAGE_PREFIX = 'lwm.'
const CANDIDATE_PREFIX = 'lwm.candidate.'
const SETTINGS_PREFIX = 'lwm.candidate.settings.'

/** List-shaped data owned by other candidate features (saved jobs, applications, job alerts). */
const EMPTY_LIST_KEYS = ['lwm.candidate.savedJobs', 'lwm.candidate.applications', 'lwm.candidate.jobAlerts']

/** One-shot flag so the page can confirm the action after the reload that applies it. */
const RESULT_FLAG_KEY = 'lwm.session.candidateData'
export const RESULT_MESSAGES = {
  reset: 'Demo workspace reset. Sample data is back in all three workspaces.',
  deleted: 'Local candidate information was deleted from this device.',
}

function removeKeys(predicate) {
  Object.keys(window.localStorage)
    .filter(predicate)
    .forEach((key) => window.localStorage.removeItem(key))
}

function applyAndReload(result, apply) {
  try {
    apply()
    window.sessionStorage.setItem(RESULT_FLAG_KEY, result)
  } catch {
    // storage unavailable: nothing was saved, so there is nothing to change
  }
  window.location.reload()
}

/** Removes everything the demo stored, then reloads so every screen starts from its sample data. */
export function resetDemoData() {
  applyAndReload('reset', () => removeKeys((key) => key.startsWith(STORAGE_PREFIX)))
}

/**
 * Removes the candidate's own information: profile, CV versions, verification, learning, saved jobs, applications
 * and alerts. Settings preferences are kept. Reloads so shared in-memory state is rebuilt from storage.
 */
export function deleteCandidateData() {
  applyAndReload('deleted', () => {
    removeKeys((key) => key.startsWith(CANDIDATE_PREFIX) && !key.startsWith(SETTINGS_PREFIX))
    window.localStorage.setItem(PROFILE_STORAGE_KEY, 'null')
    window.localStorage.setItem(CV_STORAGE_KEY, JSON.stringify(EMPTY_CV))
    window.localStorage.setItem(LEARNING_STORAGE_KEY, JSON.stringify({ purchased: [], completedLessons: {} }))
    EMPTY_LIST_KEYS.forEach((key) => window.localStorage.setItem(key, '[]'))
  })
}

/** Result of the last reset/delete ("reset" | "deleted"), or null. Read without clearing so StrictMode can re-run it. */
export function readResultFlag() {
  try {
    return window.sessionStorage.getItem(RESULT_FLAG_KEY)
  } catch {
    return null
  }
}

export function clearResultFlag() {
  try {
    window.sessionStorage.removeItem(RESULT_FLAG_KEY)
  } catch {
    // storage unavailable: nothing to clear
  }
}

const STATUS_LABEL = { 'in-review': 'In review', verified: 'Verified' }

/** Rows of the "Download your profile" CSV, built from what is saved on this device. */
export function profileExportRows({ profile, cv, verification, privacy, notifyEmail }) {
  const live = cv.versions.find((version) => version.id === cv.liveId)
  const onOff = (value) => (value ? 'On' : 'Off')
  const rows = [['Field', 'Value']]
  if (profile) {
    rows.push(
      ['Name', profile.name],
      ['Current role', profile.headline],
      ['Location', profile.location],
      ['Open to opportunities', profile.openToOpportunities ? 'Yes' : 'No'],
      ['Experience', experienceLabel(profile.yearsExperience)],
      ['Skills', profile.skills.join('; ')],
      ['Education', `${profile.degree}, ${profile.institution}`],
      ['Work preference', profile.workMode],
      ['Minimum salary', salaryLabel(profile.salaryMin) ?? 'Not set'],
    )
  } else {
    rows.push(['Profile', 'No profile information is stored on this device'])
  }
  rows.push(
    ['Live CV file name', live ? live.fileName : 'None'],
    ['CV versions', cv.versions.length],
    ['Phone verified', verification.verifiedPhone ? 'Yes' : 'No'],
    ...CREDENTIAL_CHECKS.map((check) => [
      `${check.label} check`,
      STATUS_LABEL[verification.checks[check.id]?.status] ?? 'Not started',
    ]),
    ['Profile visible to recruiters', onOff(privacy.discoverable)],
    ['Resume visibility', onOff(privacy.resumeVisible)],
    ['Matching consent', onOff(privacy.matchingConsent)],
    ['Email alerts', onOff(notifyEmail)],
  )
  return rows
}
