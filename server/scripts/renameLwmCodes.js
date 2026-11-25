import { pathToFileURL } from 'node:url'
import { connectDb, disconnectDb } from '../lib/db.js'
import { AuditEvent } from '../modules/admin/admin.model.js'
import { Certificate } from '../modules/learning/learning.model.js'
import { Notification } from '../modules/notifications/notifications.model.js'
import { Payment } from '../modules/payments/payments.model.js'
import { User } from '../modules/users/users.model.js'

/*
 * node --env-file=.env scripts/renameLwmCodes.js (once per database, 2026-11-25): the EU Jobs rename of the last
 * Local WorkMan prefix. Payment references LWM-000020 → EUJ-000020 and certificate codes LWM-7K3P-Q9XD → EUJ-7K3P-Q9XD
 * (same characters, so old printed codes and links still verify), plus the copies of them in notifications, audit events
 * and unseen celebrations. Certificate PDFs are rebuilt on their first download by the server that holds the file
 * (learning.certificates.js), since dev and production share the database but not the upload folders. Safe to rerun.
 * Run it after the EUJ code is deployed: older servers only accept LWM- certificate codes.
 */
const OLD = /^LWM-/
const renamed = (field) => ({ $cond: [{ $eq: [{ $substrCP: [field, 0, 4] }, 'LWM-'] }, { $concat: ['EUJ-', { $substrCP: [field, 4, 100] }] }, field] })
const renameField = async (Model, path) => (await Model.updateMany({ [path]: OLD }, [{ $set: { [path]: renamed(`$${path}`) } }])).modifiedCount

export async function renameLwmCodes() {
  const payments = await renameField(Payment, 'reference')

  // A certificate code is unique; one whose new code is already taken (never expected) is left as it is and listed.
  let certificates = 0
  const skipped = []
  for (const certificate of await Certificate.find({ code: OLD }, 'code')) {
    const code = certificate.code.replace(OLD, 'EUJ-')
    if (await Certificate.exists({ code })) skipped.push(certificate.code)
    else certificates += (await Certificate.updateOne({ _id: certificate._id }, { $set: { code } })).modifiedCount
  }

  const notifications = (await renameField(Notification, 'params.reference')) + (await renameField(Notification, 'params.code'))
  const audit = (await renameField(AuditEvent, 'params.reference')) + (await renameField(AuditEvent, 'params.code'))
  const celebrations = await User.updateMany({ 'celebrations.params.code': OLD }, [
    {
      $set: {
        celebrations: {
          $map: {
            input: '$celebrations',
            as: 'item',
            in: { $cond: [{ $eq: [{ $type: '$$item.params.code' }, 'string'] }, { $mergeObjects: ['$$item', { params: { $mergeObjects: ['$$item.params', { code: renamed('$$item.params.code') }] } }] }, '$$item'] },
          },
        },
      },
    },
  ])
  return { payments, certificates, notifications, audit, celebrations: celebrations.modifiedCount, skipped }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await connectDb()
  const result = await renameLwmCodes()
  const left = await Promise.all([Payment.countDocuments({ reference: OLD }), Certificate.countDocuments({ code: OLD })])
  console.log(`rename LWM → EUJ: ${result.payments} payments, ${result.certificates} certificates, ${result.notifications} notifications, ${result.audit} audit events, ${result.celebrations} users' celebrations`)
  console.log(`still LWM: ${left[0]} payments, ${left[1]} certificates${result.skipped.length ? ` (code taken: ${result.skipped.join(', ')})` : ''}`)
  await disconnectDb()
}
