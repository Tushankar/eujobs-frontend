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
  // P4-Q3: onboarding step 2 and the Company page
  company: {
    name: { min: 2, max: 120 },
    industry: { min: 2, max: 80 },
    website: { max: 300 },
    businessEmail: { max: 254 },
    businessAddress: { min: 5, max: 300 },
    registrationDetails: { max: 200 },
    description: { min: 20, max: 3000 },
  },
  // M-165, P4-D4
  accountDecisionReason: { max: 300 },
  // M-033, U26, P4-D6
  job: {
    title: { min: 3, max: 120 },
    brief: { min: 40, max: 5000 },
    responsibilities: { max: 20, itemMax: 300 },
    requiredSkills: { min: 1, max: 20, itemMax: 50 },
    preferredSkills: { max: 20, itemMax: 50 },
    experienceYears: { min: 0, max: 50 },
    salary: { min: 0, max: 100_000_000 },
    languages: { max: 10 },
  },
  // M-073, M-072, M-091, OD14
  application: { coverNote: { max: 2000 } },
  pipeline: { stages: { min: 2, max: 12 }, stageName: { min: 1, max: 24 } },
  applicationEmail: { statusDelayMs: 10 * MINUTE, newApplicationsWindowMs: HOUR },
  // M-086, M-089, U13
  message: { body: { max: 2000 } },
  messageEmail: { unreadDelayMs: 15 * MINUTE, perConversationMs: HOUR },
  // M-031, §3.6
  // digestItems: a digest lists at most this many jobs, then "See all" (owner change to P7-C4)
  jobAlert: { max: 10, name: { max: 80 }, keywords: { max: 120 }, digestItems: 20 },
  // M-080, M-029
  note: { max: 5000 },
  cvRequestDetails: { max: 1000 },
  // §3.9, M-102, M-104, U16, A: admin §9.1, P8-C1: the course builder. Lesson duration in seconds (1 s to 600 min).
  course: {
    title: { min: 3, max: 80 },
    category: { min: 2, max: 40 },
    summary: { min: 20, max: 300 },
    about: { min: 20, max: 1000 },
    tagline: { max: 120 },
    designedFor: { max: 200 },
    outcomes: { min: 1, max: 6, itemMax: 200 },
    skillTags: { min: 1, max: 10, itemMax: 50 },
    amountMinor: { min: 1, max: 99_999_999 },
    lessons: { min: 1, max: 60 },
    lessonTitle: { min: 3, max: 120 },
    lessonText: { max: 50_000 },
    lessonUrl: { max: 2048 },
    durationSec: { min: 1, max: 36_000 },
    quiz: { questions: { min: 1, max: 50 }, text: { min: 5, max: 500 }, options: { min: 2, max: 6 }, option: { max: 200 } },
    passMark: { min: 1, max: 100, default: 70 },
  },
  // U15: video heartbeats every 15 s; credit min(Δwall, 15 s) × min(rate, 2) when the position advanced without a
  // seek (the position may run ahead of the credit by `seekToleranceSec` for timer jitter); complete at 90 %.
  lessonProgress: { heartbeatSec: 15, maxRate: 2, seekToleranceSec: 2, completeShare: 0.9 },
  // M-105, U17, C18: the certificate code is LWM- and 8 characters; a revoke needs a reason (the moderation limit)
  certificate: { revokeReason: { min: 1, max: 300 }, verifyPerIp: { windowMs: MINUTE, limit: 30 } },
  // OQ-3: For-you jobs read for candidate gap skills; recruiter suggestions shown
  suggestions: { forYouJobs: 10, recruiterCourses: 3 },
  // M-185, §2.6: types are extensions; sizes in bytes. `toDisk` streams the upload to disk instead of memory.
  uploads: {
    photo: { types: ['jpg', 'png', 'webp'], maxBytes: 5 * MB },
    cv: { types: ['pdf', 'docx'], maxBytes: 10 * MB },
    evidence: { types: ['pdf', 'jpg', 'png'], maxBytes: 10 * MB },
    certificate_file: { types: ['pdf', 'jpg', 'png'], maxBytes: 10 * MB },
    kyc: { types: ['pdf', 'jpg', 'png'], maxBytes: 10 * MB },
    company_logo: { types: ['png', 'jpg', 'svg'], maxBytes: 2 * MB },
    // M-102, M-107
    course_cover: { types: ['jpg', 'png', 'webp'], maxBytes: 5 * MB },
    lesson_video: { types: ['mp4', 'webm'], maxBytes: 500 * MB, toDisk: true },
    lesson_document: { types: ['pdf'], maxBytes: 50 * MB, toDisk: true },
    // M-182
    report_voice: { types: ['mp3', 'm4a', 'wav', 'webm', 'ogg'], maxBytes: 25 * MB, toDisk: true },
  },
  // M-164, U20, OQ-1: content reports; M-167: the decision reason uses the moderation limit
  report: { details: { max: 500 }, perDay: 10, excerptEarlier: 5 },
  moderationReason: { max: 300 },
  // M-181 … M-183: the report brief
  reportBrief: { max: 500 },
  // U39: images, PDFs and CVs; video 6 hours
  signedUrlTtlMs: 15 * MINUTE,
  videoUrlTtlMs: 6 * HOUR,
  // G-1, §2.16
  places: {
    input: { min: 2, max: 60 },
    perUser: { autocomplete: { windowMs: MINUTE, limit: 60 }, details: { windowMs: MINUTE, limit: 30 } },
    cache: { autocompleteTtlMs: 10 * MINUTE, detailsTtlMs: 24 * HOUR, maxEntries: 1000 },
  },
  // OD13, U3: counted generations per user and UTC day. U6: embedding input ≈ 8,000 tokens at 4 characters a token.
  ai: { dailyGenerations: 50, embeddingMaxChars: 32_000 },
  // U5, M-047: the default policy; M-049 and A: admin §1.19: policy fields
  matching: {
    weights: { sim: 0.6, skill: 0.4 },
    thresholds: { strong: 75, good: 50 },
    cosFloor: 0.2,
    cosCeiling: 0.6,
    locationCap: 49,
    policyName: { min: 3, max: 60 },
    policyDescription: { min: 20, max: 500 },
    oversightCandidates: 4,
  },
  // M-157, M-158, A: admin §2.2; department is a descriptive label (P10-C1)
  adminRole: { name: { min: 2, max: 40 }, description: { max: 240 }, department: { max: 60 } },
  // M-206: the four paginated admin tables
  adminTable: { pageSize: 20, maxPageSize: 100 },
}
