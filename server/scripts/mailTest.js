import { config } from '../config/env.js'
import { ENUMS } from '../config/enums.js'
import { connectDb, disconnectDb } from '../lib/db.js'
import { sendEmail } from '../lib/mailer.js'
import { demoAddress } from '../seed/demo.js'
import { mailSample } from './mailSamples.js'

/*
 * npm run mail:test <type> <to> (development only, §2.13): sends one live email for the owner to
 * confirm. <to> may be "+tag", the plus-alias of SEED_ADMIN_EMAIL; the address is never printed.
 */

const [type, target, language = 'en'] = process.argv.slice(2)
if (config.isTest) throw new Error('mail:test runs in development only')
const params = type && mailSample(type, language, config.clientOrigin)
if (!params || !target) {
  throw new Error(`Usage: npm run mail:test <${ENUMS.emailType.filter((name) => mailSample(name, 'en', '')).join('|')}> <+tag|address> [en|es|fr]`)
}

const to = target.startsWith('+') ? demoAddress(target.slice(1)) : target
await connectDb()
const status = await sendEmail({ type, to, language, params })
console.log(`mail:test ${type} (${language}) to ${target.startsWith('+') ? `the ${target} alias` : 'the given address'}: ${status}`)
await disconnectDb()
