import { pathToFileURL } from 'node:url'
import { connectDb, disconnectDb } from '../lib/db.js'
import { refreshStalePdfs } from '../modules/learning/learning.certificates.js'
import { Certificate } from '../modules/learning/learning.model.js'
import { User } from '../modules/users/users.model.js'

/*
 * node --env-file=.env scripts/rebuildCertificatePdfs.js (once, after the "Heritage" certificate design is deployed,
 * 2026-11-25): redraws every valid certificate's PDF in the current design, under the same code and link. Only PDFs
 * whose file this server holds are rebuilt (dev and production share the database, not the upload folders), so run it
 * on the production server; any left over are rebuilt on their first download. Safe to rerun.
 */
export async function rebuildCertificatePdfs() {
  const holders = await Certificate.distinct('userId', { status: 'valid', pdfFileId: { $ne: null } })
  let rebuilt = 0
  for (const user of await User.find({ _id: { $in: holders } })) rebuilt += await refreshStalePdfs(user, { status: 'valid' })
  return { rebuilt }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await connectDb()
  const { rebuilt } = await rebuildCertificatePdfs()
  const valid = await Certificate.countDocuments({ status: 'valid', pdfFileId: { $ne: null } })
  console.log(`certificate PDFs rebuilt in the current design: ${rebuilt} (valid certificates: ${valid})`)
  await disconnectDb()
}
