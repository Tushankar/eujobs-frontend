import mongoose from 'mongoose'
import { config } from '../config/env.js'
// Every model is registered here so createIndexes makes all unique and TTL indexes before any data (§4.3).
import '../modules/users/users.model.js'
import '../modules/auth/auth.model.js'
import '../modules/meta/meta.model.js'
import '../modules/payments/payments.model.js'
import '../modules/admin/admin.model.js'
import '../modules/files/files.model.js'
import '../modules/candidates/candidates.model.js'
import '../modules/cv/cv.model.js'
import '../modules/verification/verification.model.js'
import '../modules/companies/companies.model.js'
import '../modules/applications/applications.model.js'
import '../modules/jobs/jobs.model.js'
import '../modules/discovery/discovery.model.js'
import '../modules/learning/learning.model.js'
import './mail/emailLog.model.js'
import '../jobs/models.js'

/**
 * Connects and creates every declared index that is missing, all models at once. Never syncIndexes (perf and safety
 * 2026-11-24): it dropped any index a model does not declare, on a database other sessions and processes share. An
 * index removed from a model is dropped by hand (scripts/dropOldIndexes.js). autoIndex is off, as this does it.
 */
export async function connectDb() {
  await mongoose.connect(config.mongodbUri, { dbName: config.dbName, autoIndex: false })
  await Promise.all(Object.values(mongoose.models).map((model) => model.createIndexes()))
}

export function disconnectDb() {
  return mongoose.disconnect()
}

export function dbStatus() {
  return mongoose.connection.readyState === 1 ? 'up' : 'down'
}
