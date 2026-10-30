import { Router } from 'express'
import mongoose from 'mongoose'
import { tick } from '../jobs/scheduler.js'
import { capturedMail } from '../lib/mailer.js'
import { resetRateLimits } from '../middleware/rateLimit.js'

/* /_test routes (§2.13), mounted only when NODE_ENV=test. Dates in /db bodies use EJSON ({ "$date": "…" }). */
const { EJSON } = mongoose.mongo.BSON
const router = Router()

router.post('/reset', async (req, res) => {
  await resetRateLimits()
  capturedMail.length = 0
  res.status(204).end()
})

router.get('/mail', (req, res) => {
  const { to, type } = req.query
  const items = capturedMail.filter((mail) => (!to || mail.to === String(to).toLowerCase()) && (!type || mail.type === type))
  res.json({ items, total: items.length, page: 1, pageSize: items.length })
})

router.post('/scheduler/tick', async (req, res) => {
  await tick(req.body.now ? new Date(req.body.now) : new Date())
  res.status(204).end()
})

const DB_OPS = {
  find: (collection, { filter }) => collection.find(filter).toArray(),
  count: (collection, { filter }) => collection.countDocuments(filter),
  insertOne: (collection, { doc }) => collection.insertOne(doc),
  updateMany: (collection, { filter, update }) => collection.updateMany(filter, update),
  deleteMany: (collection, { filter }) => collection.deleteMany(filter),
}

router.post('/db', async (req, res) => {
  const { collection, op, ...args } = EJSON.deserialize(req.body)
  const run = DB_OPS[op]
  if (!run) return res.status(422).json({ error: { code: 'VALIDATION_FAILED', fields: { op: 'invalid' } } })
  const result = await run(mongoose.connection.collection(collection), { filter: {}, ...args })
  res.json(EJSON.serialize({ result }))
})

export default router
