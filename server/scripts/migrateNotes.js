import { connectDb, disconnectDb } from '../lib/db.js'
import { CandidateNote } from '../modules/discovery/discovery.model.js'

/*
 * node --env-file=.env scripts/migrateNotes.js (once per database, 2026-11-05): the single note per company and
 * candidate becomes the first entry of the notes list (M-080, owner decision). Its last editor becomes its author;
 * an empty note is removed. The old one-note-per-candidate unique index was dropped by syncIndexes on connect then (since
 * 2026-11-24 connecting only creates indexes: scripts/dropOldIndexes.js lists undeclared ones). Safe to rerun.
 */
await connectDb()
const notes = CandidateNote.collection
const removed = await notes.deleteMany({ authorId: { $exists: false }, $or: [{ text: { $exists: false } }, { text: { $regex: /^\s*$/ } }] })
const moved = await notes.updateMany({ authorId: { $exists: false }, updatedBy: { $exists: true } }, [{ $set: { authorId: '$updatedBy' } }, { $unset: 'updatedBy' }])
const orphans = await notes.countDocuments({ authorId: { $exists: false } })
console.log(`migrate notes: ${moved.modifiedCount} kept as entries, ${removed.deletedCount} empty removed, ${orphans} without an author left`)
await disconnectDb()
