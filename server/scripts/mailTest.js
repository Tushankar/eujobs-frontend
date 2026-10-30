import { config } from '../config/env.js'
import { connectDb, disconnectDb } from '../lib/db.js'
import { t } from '../lib/i18n.js'
import { sendEmail } from '../lib/mailer.js'
import { demoAddress } from '../seed/demo.js'

/*
 * npm run mail:test <type> <to> (development only, §2.13): sends one live email for the owner to
 * confirm. <to> may be "+tag", the plus-alias of SEED_ADMIN_EMAIL; the address is never printed.
 */
const SAMPLE_PARAMS = {
  verify_email: { link: `${config.clientOrigin}/verify-email?token=mail-test` },
  already_registered: { link: `${config.clientOrigin}/sign-in`, secondaryLink: `${config.clientOrigin}/forgot-password` },
  recruiter_email_code: { code: '123456' },
  password_reset: { link: `${config.clientOrigin}/reset-password?token=mail-test` },
  verification_approved: { link: `${config.clientOrigin}/candidate/verification` },
  verification_rejected: { reason: 'The photo page is not readable.', link: `${config.clientOrigin}/candidate/verification` },
}

const [type, target, language = 'en'] = process.argv.slice(2)
if (config.isTest) throw new Error('mail:test runs in development only')
if (!SAMPLE_PARAMS[type] || !target) {
  throw new Error(`Usage: npm run mail:test <${Object.keys(SAMPLE_PARAMS).join('|')}> <+tag|address> [en|es|fr]`)
}

const to = target.startsWith('+') ? demoAddress(target.slice(1)) : target
await connectDb()
// Verification emails name the check in the recipient's language, as the decision does.
const check = type.startsWith('verification_') ? { check: t(language, 'verification.category.identity') } : {}
const status = await sendEmail({ type, to, language, params: { name: 'Mail test', ...check, ...SAMPLE_PARAMS[type] } })
console.log(`mail:test ${type} (${language}) to ${target.startsWith('+') ? `the ${target} alias` : 'the given address'}: ${status}`)
await disconnectDb()
