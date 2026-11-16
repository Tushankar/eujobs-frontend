import { existsSync, readFileSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { basename, dirname } from 'node:path'
import { connectDb, disconnectDb } from '../lib/db.js'
import { absolutePath, storeFile } from '../lib/files.js'
import { Company } from '../modules/companies/companies.model.js'
import { File } from '../modules/files/files.model.js'

/*
 * node --env-file=.env scripts/addCompanyLogos.js (owner 2026-11-16: every demo company shows a logo, not initials).
 * Gives these companies their original logo when they have none. Dev and production share the database but not
 * the upload folder, so run it on both: the first run sets the logo and writes its file; a run on the other machine
 * finds the logo set and writes the same file at the same path. A logo the company uploaded itself is never touched.
 * Safe to rerun.
 */
const LOGOS = [
  { company: 'Acme Studio', asset: new URL('../seed/assets/logos/acme.png', import.meta.url) },
  { company: 'Chen Talent Partners Ltd', asset: new URL('../seed/assets/logos/chen.png', import.meta.url) },
  { company: 'Espinoza Everett Associates', asset: new URL('./assets/espinoza-everett.png', import.meta.url) },
]

await connectDb()
for (const { company: name, asset } of LOGOS) {
  const originalName = basename(asset.pathname)
  const buffer = readFileSync(asset)
  const company = await Company.findOne({ displayName: name })
  if (!company) {
    console.log(`${name}: no such company, skipped`)
    continue
  }
  const file = company.logoFileId && (await File.findById(company.logoFileId))
  if (!file) {
    const stored = await storeFile({ ownerId: company.ownerUserId, purpose: 'company_logo', buffer, ext: 'png', originalName })
    company.logoFileId = stored._id
    await company.save()
    console.log(`${name}: logo set`)
  } else if (file.originalName !== originalName) {
    console.log(`${name}: has its own logo, left as is`)
  } else if (!existsSync(absolutePath(file))) {
    await mkdir(dirname(absolutePath(file)), { recursive: true })
    await writeFile(absolutePath(file), buffer)
    console.log(`${name}: logo file written on this machine`)
  } else {
    console.log(`${name}: logo already in place`)
  }
}
await disconnectDb()
