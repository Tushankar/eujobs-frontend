import { connectDb, disconnectDb } from '../lib/db.js'
import { CandidateProfile } from '../modules/candidates/candidates.model.js'

/*
 * node --env-file=.env scripts/migrateRightToWork.js (once per database, 2026-11-16: the platform went worldwide).
 * Right-to-work regions were 'eu' and 'uk'; an entry is now the EU group ('EU') or a country code, so 'eu' becomes 'EU'
 * and 'uk' becomes 'GB'. Entries keep their ids, statuses, permit dates and verification checks. Safe to rerun.
 */
const RENAMES = { eu: 'EU', uk: 'GB' }

await connectDb()
const profiles = CandidateProfile.collection
for (const [from, to] of Object.entries(RENAMES)) {
  const result = await profiles.updateMany({ 'rightToWork.region': from }, { $set: { 'rightToWork.$[entry].region': to } }, { arrayFilters: [{ 'entry.region': from }] })
  console.log(`migrate right to work: ${result.modifiedCount} profiles ${from} → ${to}`)
}
await disconnectDb()
