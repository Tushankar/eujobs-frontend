import { spawnSync } from 'node:child_process'

/*
 * npm run stripe:check-secret (P8): asks the Stripe CLI for the signing secret `stripe listen` uses with this
 * key and compares it with STRIPE_WEBHOOK_SECRET. Prints only "match" or "mismatch"; no value is ever shown.
 */
const result = spawnSync('stripe', ['listen', '--api-key', process.env.STRIPE_SECRET_KEY, '--print-secret'], { encoding: 'utf8' })
if (result.status !== 0) {
  console.error(`stripe listen --print-secret failed (exit ${result.status}${result.error ? `, ${result.error.code}` : ''})`)
  process.exit(1)
}
const matches = result.stdout.trim() === process.env.STRIPE_WEBHOOK_SECRET
console.log(matches ? 'match' : 'mismatch')
process.exitCode = matches ? 0 : 1
