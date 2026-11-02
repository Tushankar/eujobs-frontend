import Stripe from 'stripe'
import { config } from '../config/env.js'
import { AppError } from './errors.js'

/*
 * Stripe client (§2.10), test mode only. The API version is pinned to the SDK default at install time.
 * Every customer the app creates carries metadata.db and metadata.userId (P5-Q3), so seed:demo can remove
 * the customers of its own database.
 */
export const STRIPE_API_VERSION = '2026-10-28.endive'

const realClient = new Stripe(config.stripe.secretKey, { apiVersion: STRIPE_API_VERSION })
let client = realClient

/** The client in use; tests swap in a fake for calls made while handling constructed webhook payloads. */
export const stripe = () => client

export function setStripeClient(fake) {
  client = fake ?? realClient
}

/** Runs a Stripe call; an unknown id becomes NOT_FOUND, any other failure PAYMENT_PROVIDER_ERROR (502), without Stripe's message. */
export async function callStripe(fn) {
  try {
    return await fn(client)
  } catch (error) {
    if (error.code === 'resource_missing') throw new AppError('NOT_FOUND')
    console.error(`Stripe call failed: ${error.type ?? error.name} ${error.code ?? ''}`.trim())
    throw new AppError('PAYMENT_PROVIDER_ERROR')
  }
}

/** Verifies the webhook signature against STRIPE_WEBHOOK_SECRET and returns the event (throws on a bad one). */
export function constructEvent(rawBody, signature) {
  return realClient.webhooks.constructEvent(rawBody, signature, config.stripe.webhookSecret)
}

/** A signed header for a constructed payload (API tests and e2e helpers; no network). */
export function testSignature(payload) {
  return realClient.webhooks.generateTestHeaderString({ payload, secret: config.stripe.webhookSecret })
}

export const fromUnix = (seconds) => (seconds ? new Date(seconds * 1000) : null)
