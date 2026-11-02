import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import { config } from './config/env.js'
import { errorHandler, notFound } from './middleware/error.js'
import { webhookRouter } from './modules/payments/payments.routes.js'
import v1 from './routes/v1.js'

/* The Express app without listening, so tests can import it (§2.1, §2.12). */
const app = express()

// Requests reach the API directly or through a local tunnel (C26).
app.set('trust proxy', 'loopback')
app.use(helmet())
app.use(cors({ origin: config.clientOrigin }))
// The Stripe webhook needs the raw body for its signature (§2.10), so it comes before the JSON parser.
app.use('/api/v1/stripe/webhook', webhookRouter)
app.use(express.json({ limit: '1mb' }))
app.use('/api/v1', v1)
app.use(notFound)
app.use(errorHandler)

export default app
