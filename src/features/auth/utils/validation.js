/*
 * Form validation for the auth + onboarding screens. Each validator returns an object of
 * { fieldName: 'message naming the problem' } (empty when the form is valid).
 */
import { DEMO_OTP } from '../data/onboarding.js'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MIN_PASSWORD_LENGTH = 8
const ACCEPTED_FILE_PATTERN = /\.(pdf|jpe?g|png)$/i

const isBlank = (value) => !value || !value.trim()

function checkEmail(value, { missing, example }) {
  if (isBlank(value)) return missing
  if (!EMAIL_PATTERN.test(value.trim())) return `Enter a valid email address, like ${example}.`
  return undefined
}

function checkPhone(value) {
  if (isBlank(value)) return 'Enter your phone number.'
  const digits = value.replace(/\D/g, '')
  if (!/^\+?[\d\s().-]+$/.test(value.trim()) || digits.length < 7 || digits.length > 15) {
    return 'Enter a valid phone number, using 7 to 15 digits.'
  }
  return undefined
}

function checkWebsite(value) {
  if (isBlank(value)) return 'Enter your company website.'
  try {
    const url = new URL(/^https?:\/\//i.test(value.trim()) ? value.trim() : `https://${value.trim()}`)
    if (url.hostname.includes('.')) return undefined
  } catch {
    // falls through to the message below
  }
  return 'Enter a valid website, like https://example.com.'
}

/** Password rule stated in the Figma frames: "Use at least 8 characters." */
function checkPasswordPair({ password, confirmPassword }, { optional = false } = {}) {
  const errors = {}
  if (optional && !password && !confirmPassword) return errors
  if (!password) errors.password = 'Enter a password.'
  else if (password.length < MIN_PASSWORD_LENGTH) errors.password = 'Use at least 8 characters.'
  if (!confirmPassword) errors.confirmPassword = 'Re-enter your password.'
  else if (password && confirmPassword !== password) errors.confirmPassword = 'Passwords do not match.'
  return errors
}

function compact(errors) {
  return Object.fromEntries(Object.entries(errors).filter(([, message]) => message))
}

export function validateSignIn({ email, password }, exampleEmail = 'you@example.com') {
  return compact({
    email: checkEmail(email, { missing: 'Enter your email address.', example: exampleEmail }),
    password: password ? undefined : 'Enter your password.',
  })
}

export function validateCandidateSignUp({ fullName, email, password, confirmPassword }) {
  return compact({
    fullName: isBlank(fullName) ? 'Enter your full name.' : undefined,
    email: checkEmail(email, { missing: 'Enter your email address.', example: 'you@example.com' }),
    ...checkPasswordPair({ password, confirmPassword }),
  })
}

/**
 * Recruiter account fields (recruiter sign-up and onboarding step 1). `optional` passwords
 * apply when the account step was already completed in this session.
 */
export function validateRecruiterAccount(values, options) {
  return compact({
    fullName: isBlank(values.fullName) ? 'Enter your full name.' : undefined,
    jobTitle: isBlank(values.jobTitle) ? 'Enter your job title or role.' : undefined,
    workEmail: checkEmail(values.workEmail, { missing: 'Enter your work email.', example: 'you@company.com' }),
    phone: checkPhone(values.phone),
    ...checkPasswordPair(values, options),
    terms: values.terms ? undefined : 'Accept the Terms of Service and Privacy Policy to continue.',
  })
}

export function validateCompany(values) {
  return compact({
    companyName: isBlank(values.companyName) ? 'Enter the legal company name.' : undefined,
    website: checkWebsite(values.website),
    businessEmail: checkEmail(values.businessEmail, {
      missing: 'Enter the business email.',
      example: 'hello@company.com',
    }),
    industry: isBlank(values.industry) ? 'Enter your industry.' : undefined,
    companySize: values.companySize ? undefined : 'Select a company size.',
    country: isBlank(values.country) ? 'Enter the country.' : undefined,
    businessAddress: isBlank(values.businessAddress) ? 'Enter the business address.' : undefined,
  })
}

/** Returns an error message if `fileName` is not a PDF, JPG or PNG. */
export function checkDocumentFileName(fileName) {
  return ACCEPTED_FILE_PATTERN.test(fileName) ? undefined : 'Choose a PDF, JPG, or PNG file.'
}

export function validateKyc({ identity, registration }) {
  return compact({
    identity: identity ? undefined : 'Choose your government-issued identity document.',
    registration: registration ? undefined : 'Choose your company registration certificate.',
  })
}

export function validateOtps({ emailOtp = '', phoneOtp = '' }) {
  const check = (code, channel) => {
    if (!code.trim()) return `Enter the code for your ${channel}.`
    if (code.trim() !== DEMO_OTP) return 'That code does not match. Use the demo code shown below the field.'
    return undefined
  }
  return compact({ emailOtp: check(emailOtp, 'email'), phoneOtp: check(phoneOtp, 'phone') })
}
