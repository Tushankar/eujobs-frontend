import express, { Router } from 'express'
import { AppError } from '../../lib/errors.js'
import { constructEvent } from '../../lib/stripe.js'
import { validate } from '../../lib/validate.js'
import { requireApprovedRecruiter, requireAuth, requireRole, requireVerifiedEmail } from '../../middleware/auth.js'
import * as schemas from './payments.schemas.js'
import * as payments from './payments.service.js'

/** C, or an approved recruiter (R✓): the people who can buy and who have payment rows (§5). */
function requireBuyer(req, res, next) {
  if (req.user.role === 'candidate') return requireVerifiedEmail(req, res, next)
  if (req.user.role === 'recruiter') return requireApprovedRecruiter(req, res, next)
  throw new AppError('FORBIDDEN')
}

/* /payments: quote, Checkout sessions (plan: candidates; courses: candidates and approved recruiters), Portal. */
export const paymentsRouter = Router()
paymentsRouter.use(requireAuth, requireBuyer)

paymentsRouter.get('/quote', validate({ query: schemas.itemQuery }), async (req, res) => {
  res.json(await payments.quote(req.user, req.query))
})

paymentsRouter.post('/checkout-sessions', validate({ body: schemas.checkoutBody }), async (req, res) => {
  res.status(201).json(await payments.createCheckoutSession(req.user, req.body))
})

paymentsRouter.get('/checkout-sessions/:id', validate({ params: schemas.sessionParams }), async (req, res) => {
  res.json(await payments.checkoutSessionStatus(req.user, req.params.id))
})

paymentsRouter.post('/portal-session', requireRole('candidate'), async (req, res) => {
  res.json(await payments.createPortalSession(req.user))
})

/* GET /me/payments: own rows with receipt links (M-122). */
export const myPaymentsRouter = Router()
myPaymentsRouter.get('/', requireAuth, requireBuyer, async (req, res) => {
  const items = await payments.listOwnPayments(req.user._id)
  res.json({ items, total: items.length, page: 1, pageSize: items.length })
})

/* GET /candidate/subscription: the Billing card (status, period, currency; C14). */
export const subscriptionRouter = Router()
subscriptionRouter.get('/', requireAuth, requireRole('candidate'), async (req, res) => {
  res.json({ subscription: await payments.subscriptionDto(req.user._id) })
})

/*
 * POST /stripe/webhook (§2.10): raw body, signature checked, mounted before express.json. A bad signature → 400;
 * a failing handler → 500 so Stripe retries.
 */
export const webhookRouter = Router()
webhookRouter.post('/', express.raw({ type: 'application/json' }), async (req, res) => {
  let event
  try {
    event = constructEvent(req.body, req.get('stripe-signature') ?? '')
  } catch {
    return res.status(400).json({ error: { code: 'VALIDATION_FAILED', fields: { signature: 'invalid' } } })
  }
  await payments.handleStripeEvent(event)
  res.json({ received: true })
})
