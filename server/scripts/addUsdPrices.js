import { connectDb, disconnectDb } from '../lib/db.js'
import { pricesFromEuro } from '../lib/fxRates.js'
import { Course } from '../modules/learning/learning.model.js'

/*
 * node --env-file=.env scripts/addUsdPrices.js (once per database, 2026-11-16: the platform went worldwide and every
 * country outside EU + UK pays in USD). Every paid course without a USD price gets one, converted from its EUR price at
 * the ECB rate with the course builder's rounding. Plans get USD from `npm run seed:catalog`. Safe to rerun.
 */
await connectDb()
const courses = await Course.find({ isFree: { $ne: true }, 'prices.0': { $exists: true }, 'prices.currency': { $ne: 'USD' } })
const without = []
let added = 0
for (const course of courses) {
  const euro = course.prices.find((price) => price.currency === 'EUR')
  if (!euro) {
    without.push(course.title)
    continue
  }
  const {
    prices: [usd],
  } = await pricesFromEuro(euro.amountMinor, ['USD'])
  await Course.updateOne({ _id: course._id }, { $push: { prices: usd } })
  added += 1
}
console.log(`add USD prices: ${added} courses priced in USD${without.length ? `; no EUR price to convert from: ${without.join(', ')}` : ''}`)
await disconnectDb()
