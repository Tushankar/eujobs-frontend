import app from './app.js'
import { config } from './config/env.js'
import { migrateAiCacheSubjects } from './lib/ai.js'
import { connectDb } from './lib/db.js'
import { startScheduler } from './jobs/scheduler.js'
import { preloadGeoip } from './modules/auth/sessions.service.js'
import { attachSignaling } from './modules/interviews/interviews.call.js'
import { enforceFreeJobLimit } from './modules/jobs/jobs.service.js'
import { migrateEmailToggle } from './modules/notifications/notifications.service.js'
import { ensureSectors } from './modules/meta/sectors.service.js'
import { ensureSites } from './modules/meta/sites.service.js'

await connectDb()
await migrateEmailToggle()
await enforceFreeJobLimit()
await migrateAiCacheSubjects()
// 2026-11-24: the starter job sectors, where missing.
await ensureSectors()
// 2026-11-24: the starter sector sites, where missing.
await ensureSites()
const server = app.listen(config.port, () => {
  console.log(`API listening on port ${config.port} (database ${config.dbName})`)
  // perf 2026-11-24: the sign-in geoip database loads now rather than on the first sign-in.
  preloadGeoip().catch((error) => console.error(`geoip preload failed: ${error.message}`))
})
// §3.23: the interview signaling WebSocket shares the API's port.
attachSignaling(server)
await startScheduler()
