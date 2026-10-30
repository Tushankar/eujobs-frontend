export const VERIFICATION_STORAGE_KEY = 'lwm.candidate.verification'

/**
 * The device-only verification mock. The Verification page reads the server since Phase 3; Data & account still
 * reads this until Phase 12 (P3-D10).
 *
 * Persisted verification state. `phone` is the field value, `verifiedPhone` the (normalised) number that was
 * confirmed. Each credential entry is null (not started) or { status, evidenceType, fileName, submittedAt }
 * with status `in-review` | `verified`.
 */
export const INITIAL_VERIFICATION = {
  phone: '',
  verifiedPhone: null,
  checks: { identity: null, academic: null, employment: null },
}

/** The three named credential checks, with the copy from the Figma frame. */
export const CREDENTIAL_CHECKS = [
  {
    id: 'identity',
    label: 'Identity',
    description: 'Government-issued photo ID reviewed against the account holder’s details.',
    accepted: 'Accepted evidence: Passport, driving licence, or national identity card',
    evidenceTypes: ['Passport', 'Driving licence', 'National identity card'],
  },
  {
    id: 'academic',
    label: 'Academic qualifications',
    description: 'Selected qualification evidence reviewed against the education stated in your profile.',
    accepted: 'Accepted evidence: Degree certificate, diploma, or official transcript',
    evidenceTypes: ['Degree certificate', 'Diploma', 'Official transcript'],
  },
  {
    id: 'employment',
    label: 'Employment documents',
    description: 'Selected employment evidence reviewed against a role or employer stated in your profile.',
    accepted: 'Accepted evidence: Employment letter, contract page, or verified reference',
    evidenceTypes: ['Employment letter', 'Contract page', 'Verified reference'],
  },
]
