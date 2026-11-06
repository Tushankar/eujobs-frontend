import app from './app.js'
import { config } from './config/env.js'
import { migrateAiCacheSubjects } from './lib/ai.js'
import { connectDb } from './lib/db.js'
import { startScheduler } from './jobs/scheduler.js'
import { attachSignaling } from './modules/interviews/interviews.call.js'
import { enforceFreeJobLimit } from './modules/jobs/jobs.service.js'
import { migrateEmailToggle } from './modules/notifications/notifications.service.js'

await connectDb()
await migrateEmailToggle()
await enforceFreeJobLimit()
await migrateAiCacheSubjects()
const server = app.listen(config.port, () => console.log(`API listening on port ${config.port} (database ${config.dbName})`))
// §3.23: the interview signaling WebSocket shares the API's port.
attachSignaling(server)
await startScheduler()
