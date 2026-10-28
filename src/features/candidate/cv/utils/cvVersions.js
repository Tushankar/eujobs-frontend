import { ACCEPTED_CV_EXTENSIONS, DRAFT_NOTE, MAX_CV_SIZE_MB } from '../data/cvVersions.js'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "13 Oct 2026, 10:36" */
export function formatVersionDate(iso) {
  const date = new Date(iso)
  const pad = (value) => String(value).padStart(2, '0')
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}, ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** Returns an error message for a file that cannot be added as a CV version, or '' when it is fine. */
export function validateCvFile(file) {
  const extension = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')).toLowerCase() : ''
  if (!ACCEPTED_CV_EXTENSIONS.includes(extension)) {
    return `${file.name} is not a PDF or DOCX file. Choose a .pdf or .docx resume.`
  }
  if (file.size === 0) return `${file.name} is empty. Choose a different file.`
  if (file.size > MAX_CV_SIZE_MB * 1024 * 1024) {
    return `${file.name} is ${(file.size / (1024 * 1024)).toFixed(1)} MB. Resumes can be up to ${MAX_CV_SIZE_MB} MB.`
  }
  return ''
}

function nextVersion(cv) {
  return cv.versions.reduce((highest, version) => Math.max(highest, version.version), 0) + 1
}

function newestFirst(versions) {
  return [...versions].sort((a, b) => b.version - a.version)
}

/** A candidate upload is approved on arrival and becomes the live CV. Only the file name is kept. */
export function addUpload(cv, fileName) {
  const live = cv.versions.find((version) => version.id === cv.liveId)
  const version = nextVersion(cv)
  const entry = {
    id: `v${version}`,
    version,
    fileName,
    createdAt: new Date().toISOString(),
    source: 'Candidate upload',
    approved: true,
    note: 'Resume uploaded and approved by the candidate.',
    snapshot: live ? live.snapshot : cv.versions[0]?.snapshot ?? { role: 'Not recorded', experience: 'Not recorded', skills: [] },
  }
  return { entry, cv: { liveId: entry.id, versions: newestFirst([...cv.versions, entry]) } }
}

/** A local, rule-based draft built from the live CV (skills grouped alphabetically). It stays pending. */
export function addDraft(cv) {
  const base = cv.versions.find((version) => version.id === cv.liveId) ?? cv.versions[0]
  const version = nextVersion(cv)
  const entry = {
    id: `v${version}`,
    version,
    fileName: base.fileName,
    createdAt: new Date().toISOString(),
    source: 'AI-assisted draft',
    approved: false,
    note: DRAFT_NOTE,
    snapshot: { ...base.snapshot, skills: [...base.snapshot.skills].sort((a, b) => a.localeCompare(b)) },
  }
  return { entry, cv: { ...cv, versions: newestFirst([...cv.versions, entry]) } }
}

export function approveVersion(cv, id) {
  return {
    liveId: id,
    versions: cv.versions.map((version) => (version.id === id ? { ...version, approved: true } : version)),
  }
}

/** Skills that appear only in `newer` (added) or only in `older` (removed). */
export function compareSkills(older, newer) {
  const olderSkills = older.snapshot.skills
  const newerSkills = newer.snapshot.skills
  return {
    added: newerSkills.filter((skill) => !olderSkills.includes(skill)),
    removed: olderSkills.filter((skill) => !newerSkills.includes(skill)),
  }
}
