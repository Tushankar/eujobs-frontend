import app from './app.js'
import { config } from './config/env.js'
import { connectDb } from './lib/db.js'
import { startScheduler } from './jobs/scheduler.js'
import { migrateEmailToggle } from './modules/notifications/notifications.service.js'

await connectDb()
await migrateEmailToggle()
app.listen(config.port, () => console.log(`API listening on port ${config.port} (database ${config.dbName})`))
await startScheduler()
