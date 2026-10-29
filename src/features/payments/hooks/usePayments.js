import { useCallback, useMemo } from 'react'
import { useSharedLocalStorage } from '@/hooks/useSharedLocalStorage.js'
import { WORKSPACES } from '@/app/workspaces.js'
import { PAYMENTS_STORAGE_KEY, SEED_PAYMENTS } from '../data/payments.js'

const NO_PAYMENTS = []

/**
 * Payments recorded on this device merged with the sample payments, newest first.
 * `usePayments('candidate')` keeps only that demo account's own payments (what its Billing tab shows);
 * with no role it returns every payment (the admin view). `record(fields)` stores one attempt and returns it.
 */
export function usePayments(ownerRole) {
  const [recorded, setRecorded] = useSharedLocalStorage(PAYMENTS_STORAGE_KEY, NO_PAYMENTS)

  const payments = useMemo(() => {
    const all = [...recorded, ...SEED_PAYMENTS].sort((a, b) => new Date(b.at) - new Date(a.at))
    if (!ownerRole) return all
    const ownerName = WORKSPACES[ownerRole].user.name
    return all.filter((payment) => payment.payerRole === ownerRole && payment.payerName === ownerName)
  }, [recorded, ownerRole])

  const record = useCallback(
    (fields) => {
      let entry
      setRecorded((current) => {
        const number = SEED_PAYMENTS.length + current.length + 1
        entry = {
          id: `payment-${Date.now().toString(36)}-${number}`,
          reference: `LWM-${String(1000 + number).padStart(5, '0')}`,
          at: new Date().toISOString(),
          currency: 'GBP',
          ...fields,
        }
        return [entry, ...current]
      })
      return entry
    },
    [setRecorded],
  )

  return { payments, record }
}
