import { rm } from 'node:fs/promises'
import { after, before, beforeEach } from 'node:test'
import request from 'supertest'
import app from '../../app.js'
import { config } from '../../config/env.js'
import { connectDb, disconnectDb } from '../../lib/db.js'
import { capturedMail } from '../../lib/mailer.js'
import { resetRateLimits } from '../../middleware/rateLimit.js'
import { hashPassword, signToken } from '../../modules/auth/auth.service.js'
import { User } from '../../modules/users/users.model.js'

export const api = () => request(app)
export const PASSWORD = 'Harbour-Lantern-58'
export const auth = (user) => ({ Authorization: `Bearer ${signToken(user)}` })

/** A non-reserved test address (nothing is really sent in test mode). */
let counter = 0
export const testEmail = (name = 'user') => `${name}.${process.pid}.${++counter}@inbox.localworkman.eu`

/** Connects once per file; before each test empties `models` and clears rate limits and captured mail. */
export function useTestDb(models = []) {
  before(() => connectDb())
  after(() => disconnectDb())
  beforeEach(async () => {
    await Promise.all(models.map((model) => model.deleteMany({})))
    await resetRateLimits()
    capturedMail.length = 0
  })
}

let passwordHash
export async function createUser(fields = {}) {
  passwordHash ??= await hashPassword(PASSWORD)
  return User.create({
    role: 'candidate',
    status: 'active',
    email: testEmail(fields.role),
    fullName: 'Test Person',
    emailVerifiedAt: new Date(),
    pickerCountry: fields.role === 'admin' ? undefined : 'GB',
    passwordHash,
    ...fields,
  })
}

export const mailTo = (to, type) => capturedMail.filter((mail) => mail.to === to && (!type || mail.type === type))

/** The `token` query parameter of the link in the last captured email of `type` to `to`. */
export function linkToken(to, type) {
  const mail = mailTo(to, type).at(-1)
  return new URL(mail.params.link).searchParams.get('token')
}

/** Moves a date field back by `ms` on the native collection (Mongoose timestamps would overwrite it). */
export function shiftBack(Model, filter, field, ms) {
  return Model.collection.updateMany(filter, [{ $set: { [field]: { $subtract: [`$${field}`, ms] } } }])
}

/** Removes the files tests wrote under UPLOAD_DIR/_test (never the development uploads). */
export function useTestUploads() {
  after(() => {
    if (!config.uploadRoot.endsWith('_test')) throw new Error('refusing to clean a non-test upload folder')
    return rm(config.uploadRoot, { recursive: true, force: true })
  })
}

/** A multipart upload of `buffer` as `file`, with extra fields. */
export function attach(req, buffer, filename, contentType, fields = {}) {
  for (const [name, value] of Object.entries(fields)) req.field(name, value)
  return req.attach('file', buffer, { filename, contentType })
}
