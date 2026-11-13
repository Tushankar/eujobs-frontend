// Temporary (pricing work, 2026-11-13): prints dev tokens for screenshots. Delete after use.
import { connectDb, disconnectDb } from '../lib/db.js'
import { signToken } from '../modules/auth/auth.service.js'
import { Subscription } from '../modules/payments/payments.model.js'
import { User } from '../modules/users/users.model.js'
await connectDb()
const admin = await User.findOne({ role: 'admin', isOwner: true, status: 'active' })
const paid = new Set((await Subscription.find({}, 'userId')).map((row) => String(row.userId)))
const candidates = await User.find({ role: 'candidate', status: 'active' }).limit(50)
const free = candidates.find((user) => !paid.has(String(user._id)))
console.log(JSON.stringify({ admin: signToken(admin), freeCandidate: signToken(free), freeEmail: free?.email }))
await disconnectDb()
