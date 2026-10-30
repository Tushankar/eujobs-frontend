/** Card helpers for the demo checkout. Nothing here talks to a payment provider. */

/** The demo card that is declined; every other valid card number is accepted. */
export const DECLINE_CARD = '4000000000000002'

export const digitsOf = (text) => text.replace(/\D/g, '')

export function formatCardNumber(text) {
  return digitsOf(text).slice(0, 19).replace(/(.{4})/g, '$1 ').trim()
}

export function formatExpiry(text) {
  const digits = digitsOf(text).slice(0, 4)
  return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits
}

export function cardBrand(digits) {
  if (/^4/.test(digits)) return 'Visa'
  if (/^(5[1-5]|2[2-7])/.test(digits)) return 'Mastercard'
  if (/^3[47]/.test(digits)) return 'Amex'
  return 'Card'
}

/** Luhn checksum, so a mistyped number is caught before "paying". */
function passesLuhn(digits) {
  let sum = 0
  for (let index = 0; index < digits.length; index += 1) {
    let digit = Number(digits[digits.length - 1 - index])
    if (index % 2 === 1) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
  }
  return sum % 10 === 0
}

function expiryError(expiry, now) {
  const match = /^(\d{2})\/(\d{2})$/.exec(expiry)
  if (!match) return 'Enter the expiry as MM/YY.'
  const month = Number(match[1])
  const year = 2000 + Number(match[2])
  if (month < 1 || month > 12) return 'Enter a month from 01 to 12.'
  if (year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1)) return 'This card has expired.'
  return ''
}

/** Field errors for the checkout form ({} when valid). */
export function validateCheckout({ name, number, expiry, cvc }, now = new Date()) {
  const errors = {}
  if (!name.trim()) errors.name = 'Enter the name on the card.'
  const digits = digitsOf(number)
  if (!digits) errors.number = 'Enter your card number.'
  else if (digits.length < 13 || digits.length > 19 || !passesLuhn(digits)) errors.number = 'Enter a valid card number.'
  const expired = expiryError(expiry, now)
  if (expired) errors.expiry = expired
  if (!/^\d{3,4}$/.test(cvc)) errors.cvc = 'Enter the 3 or 4 digit security code.'
  return errors
}
