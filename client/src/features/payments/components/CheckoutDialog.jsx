import { useCallback, useEffect, useRef, useState } from 'react'
import { Button, Modal, TextField } from '@/components/ui'
import { useGetMeQuery } from '@/app/api.js'
import { formatMoney } from '../data/payments.js'
import { usePayments } from '../hooks/usePayments.js'
import { DECLINE_CARD, cardBrand, digitsOf, formatCardNumber, formatExpiry, validateCheckout } from '../utils/card.js'
import styles from './CheckoutDialog.module.css'

const FORM_ID = 'checkout-form'
const PROCESSING_MS = 900
const EMPTY_VALUES = { name: '', number: '', expiry: '', cvc: '' }

/**
 * Demo checkout for a course or a plan. `item` = { kind, id, name, amount, caption }; pass null to close it.
 * The form is validated like a real one, but no payment provider is involved: every attempt is recorded
 * (paid, or failed for the demo decline card) and only the card brand and last four digits are kept.
 * `onPaid(payment)` runs after a successful payment, so callers unlock what was bought there.
 */
export default function CheckoutDialog({ item, payerRole, onPaid, onClose }) {
  const { record } = usePayments()
  const { data: me } = useGetMeQuery()
  const [values, setValues] = useState(EMPTY_VALUES)
  const [errors, setErrors] = useState({})
  const [failure, setFailure] = useState('')
  const [processing, setProcessing] = useState(false)
  // Each time the dialog opens for an item it starts from a clean form, even when the same item is reopened.
  const [openedFor, setOpenedFor] = useState(null)
  const itemKey = item ? `${item.kind}:${item.id}` : null
  if (itemKey !== openedFor) {
    setOpenedFor(itemKey)
    setValues(EMPTY_VALUES)
    setErrors({})
    setFailure('')
    setProcessing(false)
  }

  const setField = (field, format) => (event) => {
    const value = format ? format(event.target.value) : event.target.value
    setValues((current) => ({ ...current, [field]: value }))
    if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }))
    setFailure('')
  }

  function handleClose() {
    if (!processing) onClose()
  }

  // Modal re-focuses its first field whenever `onClose` changes, so it must not change on every keystroke.
  const latestClose = useRef(handleClose)
  useEffect(() => {
    latestClose.current = handleClose
  })
  const stableClose = useCallback(() => latestClose.current(), [])

  function handleSubmit(event) {
    event.preventDefault()
    if (processing) return
    const nextErrors = validateCheckout(values)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return
    setProcessing(true)
    window.setTimeout(() => {
      const digits = digitsOf(values.number)
      const declined = digits === DECLINE_CARD
      const payment = record({
        payerRole,
        payerName: me.fullName,
        kind: item.kind,
        itemId: item.id,
        itemName: item.name,
        amount: item.amount,
        method: { brand: cardBrand(digits), last4: digits.slice(-4) },
        status: declined ? 'failed' : 'paid',
        ...(declined && { failureReason: 'Card declined by the issuer (demo decline card).' }),
      })
      setProcessing(false)
      if (declined) setFailure('Your card was declined. No money was taken. Check the details or use another card.')
      else onPaid(payment)
    }, PROCESSING_MS)
  }

  return (
    <Modal
      open={Boolean(item)}
      onClose={stableClose}
      title={item ? `Pay for ${item.name}` : ''}
      description="Demo checkout: no payment provider is connected, nothing is charged, and your card details are never sent or saved."
      width={480}
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={processing}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID} loading={processing}>
            {processing ? 'Processing…' : `Pay ${item ? formatMoney(item.amount) : ''}`}
          </Button>
        </>
      }
    >
      {item && (
        <form id={FORM_ID} className={styles.form} onSubmit={handleSubmit} noValidate>
          <div className={styles.summary}>
            <div>
              <p className={styles.itemName}>{item.name}</p>
              <p className={styles.caption}>{item.caption}</p>
            </div>
            <p className={styles.total}>{formatMoney(item.amount)}</p>
          </div>
          <TextField
            label="Name on card"
            value={values.name}
            onChange={setField('name')}
            error={errors.name}
            autoComplete="cc-name"
            maxLength={60}
            data-autofocus
          />
          <TextField
            label="Card number"
            value={values.number}
            onChange={setField('number', formatCardNumber)}
            error={errors.number}
            inputMode="numeric"
            autoComplete="cc-number"
            placeholder="4242 4242 4242 4242"
          />
          <div className={styles.pair}>
            <TextField
              label="Expiry"
              value={values.expiry}
              onChange={setField('expiry', formatExpiry)}
              error={errors.expiry}
              inputMode="numeric"
              autoComplete="cc-exp"
              placeholder="MM/YY"
            />
            <TextField
              label="Security code"
              value={values.cvc}
              onChange={setField('cvc', (text) => digitsOf(text).slice(0, 4))}
              error={errors.cvc}
              inputMode="numeric"
              autoComplete="cc-csc"
              placeholder="123"
            />
          </div>
          <div role="alert">{failure && <p className={styles.failure}>{failure}</p>}</div>
          <p className={styles.demo}>
            Demo cards: <code>4242 4242 4242 4242</code> succeeds, <code>4000 0000 0000 0002</code> is declined. Use any
            future expiry date and any security code.
          </p>
        </form>
      )}
    </Modal>
  )
}
