/*
 * Every field, size and count limit (§2.4). GET /meta/config serves this object, so client forms
 * never hard-code a limit. Later phases add their own entries.
 */
const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
const MB = 1024 * 1024

export const LIMITS = {
  // M-006, U2
  password: { min: 8, max: 128, maxBytes: 72 },
  email: { max: 254 },
  // M-012, A: recruiter Part C
  fullName: { max: 100 },
  jobTitle: { max: 100 },
  // M-002 … M-004
  code: { length: 6, ttlMs: 10 * MINUTE, maxAttempts: 5, resendAfterMs: MINUTE, maxPerHour: 5 },
  // M-001, M-009, U21
  emailLink: { verifyTtlMs: 24 * HOUR, resetTtlMs: HOUR, inviteTtlMs: 72 * HOUR },
  // M-001, U36: verification and "already registered" emails per address
  verifyEmailSends: { perMinute: 1, perDay: 5 },
  // M-008, U1
  rateLimits: {
    failedLoginsPerEmail: { windowMs: 15 * MINUTE, limit: 5 },
    loginsPerIp: { windowMs: 15 * MINUTE, limit: 20 },
    forgotPasswordPerEmail: { windowMs: HOUR, limit: 5 },
    signUpsPerIp: { windowMs: HOUR, limit: 10 },
  },
  // OD9, OQ-6c
  nonCriticalEmailsPer24h: 400,
  // §3.2, M-018 … M-025, M-031, P3-D3 … P3-D6
  profile: {
    headline: { max: 60 },
    about: { min: 20, max: 600 },
    yearsExperience: { min: 0, max: 50 },
    skills: { min: 1, max: 12, itemMax: 30 },
    entryText: { max: 100 },
    description: { max: 1000 },
    workHistory: { max: 20 },
    education: { max: 20 },
    languages: { max: 20 },
    certificates: { max: 20 },
    salary: { min: 1, max: 100_000_000 },
    url: { max: 300 },
    rightToWork: { max: 2 },
  },
  // M-031, U18, P3-D7
  cv: { maxVersions: 20, minReadableChars: 50 },
  // M-166
  verificationReason: { max: 300 },
  // M-185, §2.6: types are extensions; sizes in bytes
  uploads: {
    photo: { types: ['jpg', 'png', 'webp'], maxBytes: 5 * MB },
    cv: { types: ['pdf', 'docx'], maxBytes: 10 * MB },
    evidence: { types: ['pdf', 'jpg', 'png'], maxBytes: 10 * MB },
    certificate_file: { types: ['pdf', 'jpg', 'png'], maxBytes: 10 * MB },
  },
  // U39
  signedUrlTtlMs: 15 * MINUTE,
  // G-1, §2.16
  places: {
    input: { min: 2, max: 60 },
    perUser: { autocomplete: { windowMs: MINUTE, limit: 60 }, details: { windowMs: MINUTE, limit: 30 } },
    cache: { autocompleteTtlMs: 10 * MINUTE, detailsTtlMs: 24 * HOUR, maxEntries: 1000 },
  },
}
