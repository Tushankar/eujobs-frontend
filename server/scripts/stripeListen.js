import { spawn } from 'node:child_process'

/*
 * npm run stripe:listen (§2.2, P8): forwards Stripe test-mode webhooks to this server. The key goes straight
 * from the environment into the CLI and is never printed; the signing secret the CLI announces is hidden.
 */
const port = process.env.PORT
const child = spawn('stripe', ['listen', '--api-key', process.env.STRIPE_SECRET_KEY, '--forward-to', `http://localhost:${port}/api/v1/stripe/webhook`])
const redact = (chunk) => chunk.toString().replace(/whsec_\w+/g, 'whsec_…')
child.stdout.on('data', (chunk) => process.stdout.write(redact(chunk)))
child.stderr.on('data', (chunk) => process.stderr.write(redact(chunk)))
child.on('exit', (code) => process.exit(code ?? 0))
process.on('SIGINT', () => child.kill())
