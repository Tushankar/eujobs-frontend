/** Recruiter onboarding: the five steps (labels and routes from the Figma frames) and demo values. */
export const ONBOARDING_STEPS = [
  { id: 'account', label: 'Account registration', path: '/recruiter/onboarding/account' },
  { id: 'company', label: 'Company information', path: '/recruiter/onboarding/company' },
  { id: 'kyc', label: 'KYC & business verification', path: '/recruiter/onboarding/kyc' },
  { id: 'verify', label: 'Verify account', path: '/recruiter/onboarding/verify' },
  { id: 'review', label: 'Admin review & approval', path: '/recruiter/onboarding/review' },
]

/** Both OTP fields accept this code; the Figma frame prints it under each field. */
export const DEMO_OTP = '123456'

/** Options for the "Company size" select (the frame only shows the closed "Select size" state). */
export const COMPANY_SIZES = [
  '1-10 employees',
  '11-50 employees',
  '51-200 employees',
  '201-500 employees',
  '501-1,000 employees',
  '1,000+ employees',
]

/**
 * Non-sensitive onboarding values kept on this device (lwm.onboarding.data). Passwords and
 * OTP codes are never stored, and neither are file contents: documents are file names only.
 */
export const EMPTY_ONBOARDING_DATA = {
  fullName: '',
  jobTitle: '',
  workEmail: '',
  phone: '',
  terms: false,
  companyName: '',
  website: '',
  businessEmail: '',
  industry: '',
  companySize: '',
  country: '',
  registrationDetails: '',
  businessAddress: '',
  documents: { identity: '', registration: '', authorization: '' },
}
