import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { stripeSecretKey } from '../lib/env.js'
import { freeCandidate, rowsOf, stripe, subscribeThroughApi, until, waitForPlan } from '../lib/payments.js'
import { db } from '../lib/testApi.js'

/**
 * P5-06 (§2.10, ordering item 11): a processed invoice.paid is sent again with `stripe events resend` → it reaches the
 * webhook a second time (stripe.log) and adds no row.
 */
export default {
  name: 'P5-06 Idempotency',
  viewports: ['D'],
  async run(ctx) {
    const { token, user } = await freeCandidate('Resend', 'GB')
    const { subscription } = await subscribeThroughApi(user)
    await waitForPlan(token, 'plus')
    await until(() => rowsOf('payments', user.id), (rows) => rows.length === 1, { label: 'the paid row' })

    const event = await until(
      async () => (await stripe.events.list({ type: 'invoice.paid', limit: 20 })).data.find((entry) => entry.data.object.id === subscription.latest_invoice),
      Boolean,
      { label: 'the invoice.paid event' },
    )
    const log = join(ctx.runDir, 'stripe.log')
    // Lines like "<--  [200] POST http://…/stripe/webhook [evt_…]": one per answered delivery.
    const deliveries = () =>
      readFileSync(log, 'utf8')
        .split('\n')
        .filter((line) => line.includes('[200] POST') && line.includes(`[${event.id}]`)).length
    await until(deliveries, (count) => count === 1, { label: 'first delivery' })

    const resend = spawnSync('stripe', ['events', 'resend', event.id, '--api-key', stripeSecretKey], { encoding: 'utf8' })
    ctx.check(resend.status === 0, `stripe events resend exited ${resend.status}`)
    await until(deliveries, (count) => count === 2, { label: 'second delivery of the same event' })
    ctx.check((await rowsOf('payments', user.id)).length === 1, 'still exactly one payment row')
    ctx.check((await db('stripeevents', 'count', { filter: { eventId: event.id } })) === 1, 'one processed-event marker')
  },
}
