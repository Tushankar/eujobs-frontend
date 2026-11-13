import { join } from 'node:path'
import { z } from 'zod'

/*
 * Reads and validates process.env once. Error messages name the variables only, never their values.
 * NODE_ENV=test switches to the test database and the test upload folder.
 */
const required = z.string().trim().min(1)

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test']),
  PORT: z.coerce.number().int().positive(),
  CLIENT_ORIGIN: z.url(),
  MONGODB_URI: required,
  JWT_SECRET: required,
  JWT_EXPIRES_IN: required,
  SMTP_HOST: required,
  SMTP_PORT: z.coerce.number().int().positive(),
  SMTP_USER: required,
  SMTP_PASS: required,
  MAIL_FROM: required,
  SEED_PASSWORD: required,
  SEED_ADMIN_EMAIL: z.email(),
  UPLOAD_DIR: required,
  FILE_URL_SECRET: required,
  STRIPE_SECRET_KEY: required,
  STRIPE_WEBHOOK_SECRET: required,
  OPENAI_API_KEY: required,
  OPENAI_MODEL: required,
  OPENAI_FAST_MODEL: required,
  OPENAI_EMBEDDING_MODEL: required,
  OPENAI_TRANSCRIBE_MODEL: required,
  GOOGLE_PLACES_API_KEY: required,
  // Testing only: 'true' makes city fields take a typed "City, Country" without calling Google.
  PLACES_MANUAL: z.enum(['true', 'false']).optional(),
  // P11d-Q29: Cloudflare Realtime TURN; without both values interview calls use STUN only.
  CLOUDFLARE_TURN_KEY_ID: z.string().trim().optional(),
  CLOUDFLARE_TURN_API_TOKEN: z.string().trim().optional(),
  // 2026-11-13: the public footer's contact details and social links; each is hidden while empty.
  CONTACT_EMAIL: z.union([z.literal(''), z.email()]).optional(),
  CONTACT_PHONE: z.string().trim().optional(),
  SOCIAL_FACEBOOK_URL: z.union([z.literal(''), z.url()]).optional(),
  SOCIAL_LINKEDIN_URL: z.union([z.literal(''), z.url()]).optional(),
  SOCIAL_INSTAGRAM_URL: z.union([z.literal(''), z.url()]).optional(),
  // 2026-11-13: the operator named in the legal texts (Terms, Privacy, Imprint); shown "to be completed" while empty.
  COMPANY_NAME: z.string().trim().optional(),
  COMPANY_ADDRESS: z.string().trim().optional(),
  COMPANY_REGISTRATION: z.string().trim().optional(),
  COMPANY_VAT: z.string().trim().optional(),
  PRIVACY_EMAIL: z.union([z.literal(''), z.email()]).optional(),
})

const result = schema.safeParse(process.env)
if (!result.success) {
  const names = [...new Set(result.error.issues.map((issue) => issue.path[0]))]
  throw new Error(`Missing or invalid environment variables: ${names.join(', ')}`)
}

const env = result.data
const isTest = env.NODE_ENV === 'test'

export const config = {
  isTest,
  port: env.PORT,
  clientOrigin: env.CLIENT_ORIGIN.replace(/\/$/, ''),
  mongodbUri: env.MONGODB_URI,
  dbName: isTest ? 'eujobs_test' : 'eujobs',
  jwt: { secret: env.JWT_SECRET, expiresIn: env.JWT_EXPIRES_IN },
  smtp: { host: env.SMTP_HOST, port: env.SMTP_PORT, user: env.SMTP_USER, pass: env.SMTP_PASS },
  mailFrom: env.MAIL_FROM,
  seed: { password: env.SEED_PASSWORD, adminEmail: env.SEED_ADMIN_EMAIL.toLowerCase() },
  uploadRoot: isTest ? join(env.UPLOAD_DIR, '_test') : env.UPLOAD_DIR,
  fileUrlSecret: env.FILE_URL_SECRET,
  stripe: { secretKey: env.STRIPE_SECRET_KEY, webhookSecret: env.STRIPE_WEBHOOK_SECRET },
  openai: {
    apiKey: env.OPENAI_API_KEY,
    model: env.OPENAI_MODEL,
    fastModel: env.OPENAI_FAST_MODEL,
    embeddingModel: env.OPENAI_EMBEDDING_MODEL,
    transcribeModel: env.OPENAI_TRANSCRIBE_MODEL,
  },
  // Server only (G-1, §2.16): never sent to the browser, a response, a log or an error.
  googlePlacesApiKey: env.GOOGLE_PLACES_API_KEY,
  placesManual: env.PLACES_MANUAL === 'true',
  // Server only, like the Places key.
  // Public: shown in the landing page footer (null while empty).
  contact: {
    email: env.CONTACT_EMAIL || null,
    phone: env.CONTACT_PHONE || null,
    social: { facebook: env.SOCIAL_FACEBOOK_URL || null, linkedin: env.SOCIAL_LINKEDIN_URL || null, instagram: env.SOCIAL_INSTAGRAM_URL || null },
  },
  // Public: the company details the legal texts name (null while empty). `email` is the contact address above.
  company: {
    name: env.COMPANY_NAME || null,
    address: env.COMPANY_ADDRESS || null,
    registration: env.COMPANY_REGISTRATION || null,
    vat: env.COMPANY_VAT || null,
    email: env.CONTACT_EMAIL || null,
    privacyEmail: env.PRIVACY_EMAIL || null,
  },
  turn: env.CLOUDFLARE_TURN_KEY_ID && env.CLOUDFLARE_TURN_API_TOKEN ? { keyId: env.CLOUDFLARE_TURN_KEY_ID, apiToken: env.CLOUDFLARE_TURN_API_TOKEN } : null,
}
