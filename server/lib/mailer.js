import nodemailer from 'nodemailer'
import { config } from '../config/env.js'
import { EMAIL_TYPES } from '../config/enums.js'
import { LIMITS } from '../config/limits.js'
import { User } from '../modules/users/users.model.js'
import { EmailLog } from './mail/emailLog.model.js'
import { renderEmail } from './mail/templates.js'

/*
 * Send pipeline (§2.8, OD9): reserved domains are only logged; non-critical mail respects the user's
 * toggle and the rolling 24 h cap; critical and decision mail always goes out. In test mode messages
 * are captured in memory (read through /_test/mail) instead of sent.
 */
const RESERVED_DOMAINS = ['example.com', 'example.org', 'example.net', 'test', 'invalid', 'localhost']
const DAY_MS = 24 * 60 * 60 * 1000

export const capturedMail = []

const transport = config.isTest
  ? null
  : nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465,
      auth: { user: config.smtp.user, pass: config.smtp.pass },
    })

export function isReservedAddress(address) {
  const domain = address.split('@').pop().toLowerCase()
  return RESERVED_DOMAINS.some((reserved) => domain === reserved || domain.endsWith(`.${reserved}`))
}

async function skipReason(emailClass, to, userId) {
  if (isReservedAddress(to)) return 'suppressed_reserved'
  if (emailClass !== 'non_critical') return null
  const user = userId ? await User.findById(userId, 'notifyEmail') : null
  if (user && !user.notifyEmail) return 'skipped_toggle'
  const sentToday = await EmailLog.countDocuments({
    class: 'non_critical',
    status: 'sent',
    createdAt: { $gte: new Date(Date.now() - DAY_MS) },
  })
  return sentToday >= LIMITS.nonCriticalEmailsPer24h ? 'skipped_cap' : null
}

/** Sends one email and logs the outcome; returns the logged status. Never throws on a send failure. */
export async function sendEmail({ type, to, userId, language = 'en', params = {} }) {
  const emailClass = EMAIL_TYPES[type]
  const log = (status, error) => EmailLog.create({ type, class: emailClass, userId, to, language, status, error })

  const skipped = await skipReason(emailClass, to, userId)
  if (skipped) {
    await log(skipped)
    return skipped
  }

  const message = { from: config.mailFrom, to, ...renderEmail(type, language, params) }
  try {
    if (transport) await transport.sendMail(message)
    else capturedMail.push({ type, to, language, params, subject: message.subject, text: message.text, html: message.html, at: new Date() })
    await log('sent')
    return 'sent'
  } catch (error) {
    console.error(`Email ${type} failed: ${error.message}`)
    await log('failed', error.message)
    return 'failed'
  }
}
