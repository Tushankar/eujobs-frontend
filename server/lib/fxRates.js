import { AppError } from './errors.js'
import { AppConfig } from '../modules/payments/payments.model.js'

/*
 * Euro reference rates from the European Central Bank (one free daily table, no key), used to turn a course's EUR
 * price into the other charging currencies. The last good table is kept in AppConfig('fxRates') and refreshed after
 * MAX_AGE_MS, so a restart or an ECB outage keeps working on the previous day's rates. API tests install a fixed
 * source (setRatesSource), so they never call the ECB; the e2e server uses the real one.
 */
const ECB_URL = 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml'
const TIMEOUT_MS = 8000
const MAX_AGE_MS = 12 * 60 * 60 * 1000

let source = null

/** Tests swap in a function returning `{ date, rates }`; no argument restores the ECB. */
export function setRatesSource(fake) {
  source = fake ?? null
}

async function fetchEcb() {
  const response = await fetch(ECB_URL, { signal: AbortSignal.timeout(TIMEOUT_MS) })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const xml = await response.text()
  const date = xml.match(/time=['"](\d{4}-\d{2}-\d{2})['"]/)?.[1]
  const rates = { EUR: 1 }
  for (const [, currency, rate] of xml.matchAll(/currency=['"]([A-Z]{3})['"]\s+rate=['"]([\d.]+)['"]/g)) rates[currency] = Number(rate)
  if (!date || Object.keys(rates).length < 2) throw new Error('unexpected ECB format')
  return { date, rates }
}

/** `{ date: 'YYYY-MM-DD', rates: { EUR: 1, GBP: 0.83, … } }`: units of each currency per euro. */
export async function euroRates() {
  if (source) return source()
  const stored = await AppConfig.findOne({ key: 'fxRates' }).lean()
  if (stored && Date.now() - new Date(stored.value.fetchedAt).getTime() < MAX_AGE_MS) return stored.value
  try {
    const table = { ...(await fetchEcb()), fetchedAt: new Date() }
    await AppConfig.updateOne({ key: 'fxRates' }, { $set: { value: table } }, { upsert: true })
    return table
  } catch (error) {
    console.error(`ECB rates request failed: ${error.name === 'Error' ? error.message : error.name}`)
    if (stored) return stored.value
    throw new AppError('FX_UNAVAILABLE')
  }
}

/**
 * A shop-style price for a converted amount in major units, like the OD1 table (SEK 249, CZK 549, HUF 8,490): whole
 * units under 10, ending in 9 under 1,000, ending in 90 from 1,000.
 */
export function nicePrice(amount) {
  if (amount < 10) return Math.max(1, Math.round(amount))
  const [step, end] = amount < 1000 ? [10, 9] : [100, 90]
  return Math.max(end, Math.round((amount - end) / step) * step + end)
}

/** Every currency's price from the EUR price (integer minor units); EUR keeps the amount it was given. */
export async function pricesFromEuro(euroMinor, currencies) {
  const { date, rates } = await euroRates()
  const prices = currencies.map((currency) => {
    if (currency === 'EUR') return { currency, amountMinor: euroMinor }
    if (!(rates[currency] > 0)) throw new AppError('FX_UNAVAILABLE')
    return { currency, amountMinor: nicePrice((euroMinor / 100) * rates[currency]) * 100 }
  })
  return { prices, ratesDate: date }
}
