import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseEnv } from 'node:util'

/*
 * Harness settings (§2.13). server/.env is parsed here only for the seeded sign-in credentials and the Stripe key;
 * the values are never printed and never copied into the environment of the server and Vite processes,
 * which read server/.env themselves. `stripe listen` gets the key as its --api-key argument (§2.13 step 4).
 */
export const ROOT = fileURLToPath(new URL('../..', import.meta.url))
export const SERVER_DIR = join(ROOT, 'server')
export const CLIENT_DIR = join(ROOT, 'client')
export const ARTIFACTS_DIR = join(ROOT, 'e2e', 'artifacts')
export const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'

export const API_PORT = 5100
export const WEB_PORT = 5174
export const WEB_URL = `http://localhost:${WEB_PORT}`
export const API_URL = `http://localhost:${API_PORT}`

const serverEnv = parseEnv(readFileSync(join(SERVER_DIR, '.env'), 'utf8'))

/** Seeded accounts: the Owner uses SEED_ADMIN_EMAIL, demo accounts its plus-aliases (P12). */
export const seedCredentials = {
  password: serverEnv.SEED_PASSWORD,
  email(tag) {
    const address = serverEnv.SEED_ADMIN_EMAIL.toLowerCase()
    if (!tag) return address
    const [local, domain] = address.split('@')
    return `${local}+${tag}@${domain}`
  },
}

/** Stripe test-mode key for `stripe listen` and the Stripe helpers; held in memory only, never printed (P8). */
export const stripeSecretKey = serverEnv.STRIPE_SECRET_KEY

/** OpenAI key for the one-off voice-note fixture (P10-Q3); held in memory only, never printed. */
export const openaiApiKey = serverEnv.OPENAI_API_KEY

/** The API in test mode: test database, captured mail, /_test routes, no scheduler timer. */
export const serverChildEnv = { ...process.env, NODE_ENV: 'test', PORT: String(API_PORT), CLIENT_ORIGIN: WEB_URL }
export const viteChildEnv = { ...process.env, VITE_API_PROXY: API_URL }
