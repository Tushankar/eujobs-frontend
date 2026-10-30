import mongoose from 'mongoose'
import { config } from '../config/env.js'
// Every model is registered here so syncIndexes creates all unique and TTL indexes before any data (§4.3).
import '../modules/users/users.model.js'
import '../modules/auth/auth.model.js'
import '../modules/meta/meta.model.js'
import '../modules/payments/payments.model.js'
import '../modules/admin/admin.model.js'
import '../modules/files/files.model.js'
import '../modules/candidates/candidates.model.js'
import '../modules/cv/cv.model.js'
import '../modules/verification/verification.model.js'
import './mail/emailLog.model.js'
import '../jobs/models.js'

export async function connectDb() {
  await mongoose.connect(config.mongodbUri, { dbName: config.dbName })
  for (const model of Object.values(mongoose.models)) await model.syncIndexes()
}

export function disconnectDb() {
  return mongoose.disconnect()
}

export function dbStatus() {
  return mongoose.connection.readyState === 1 ? 'up' : 'down'
}
