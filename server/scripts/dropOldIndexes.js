import mongoose from 'mongoose'
// Registers every model (as the API does), so the listing below covers them all.
import '../app.js'
import { connectDb, disconnectDb } from '../lib/db.js'

/*
 * node --env-file=.env scripts/dropOldIndexes.js (once per database, perf 2026-11-24): connecting no longer runs
 * syncIndexes (it dropped every index a model does not declare, on a shared database), so indexes a model stopped
 * declaring are dropped here by name. Then lists any other index no model declares, without dropping it. Safe to rerun.
 */
const OLD = [
  // Replaced by { userId: 1, at: -1, _id: -1 }, which also serves the list's { at: -1, _id: -1 } sort.
  { collection: 'notifications', name: 'userId_1_at_-1' },
]

await connectDb()
const db = mongoose.connection.db
for (const { collection, name } of OLD) {
  const exists = (await db.collection(collection).indexes()).some((index) => index.name === name)
  if (exists) await db.collection(collection).dropIndex(name)
  console.log(`${collection}.${name}: ${exists ? 'dropped' : 'already gone'}`)
}
for (const model of Object.values(mongoose.models)) {
  const { toDrop } = await model.diffIndexes()
  if (toDrop.length) console.log(`${model.collection.collectionName}: not declared (kept): ${toDrop.join(', ')}`)
}
await disconnectDb()
