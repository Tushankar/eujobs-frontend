import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'
import { Button, Modal, Skeleton, SkeletonRegion } from '@/components/ui'
import { useErrorText } from '@/lib/forms.js'
import { useFormat } from '@/lib/preferences.js'
import { useCreateCheckoutSessionMutation, useGetQuoteQuery } from '../api.js'
import styles from './CheckoutDialog.module.css'

/**
 * The step before Stripe (M-124): the server's item, price and currency, then "Continue to secure payment" opens
 * Stripe's hosted Checkout. `item` = { kind, itemId } (null closes the dialog). Stripe returns to the role's return
 * page and then to `from` (default: this page), or straight to `from` when the buyer cancels (M-125).
 */
export default function CheckoutDialog({ item, from, description, onClose }) {
  const { t } = useTranslation('billing')
  const format = useFormat()
  const errorText = useErrorText()
  const { pathname, search } = useLocation()
  const { data: quote, error: quoteError, isLoading } = useGetQuoteQuery(item, { skip: !item })
  const [createSession, { error: sessionError, reset }] = useCreateCheckoutSessionMutation()
  const [leaving, setLeaving] = useState(false)
  // Each time the dialog opens for an item it starts clean, even when the same item is reopened.
  const [openedFor, setOpenedFor] = useState(null)
  const itemKey = item ? `${item.kind}:${item.itemId}` : null
  if (itemKey !== openedFor) {
    setOpenedFor(itemKey)
    setLeaving(false)
  }

  function handleClose() {
    if (leaving) return
    // A failed attempt is not shown again when the dialog reopens.
    reset()
    onClose()
  }

  // Modal re-focuses its first field whenever `onClose` changes, so it must not change on every render.
  const latestClose = useRef(handleClose)
  useEffect(() => {
    latestClose.current = handleClose
  })
  const stableClose = useCallback(() => latestClose.current(), [])

  // Coming back from Stripe with the browser's Back button restores this page as it was left.
  useEffect(() => {
    const restore = (event) => event.persisted && setLeaving(false)
    window.addEventListener('pageshow', restore)
    return () => window.removeEventListener('pageshow', restore)
  }, [])

  async function handleContinue() {
    setLeaving(true)
    try {
      const session = await createSession({ ...item, from: from ?? `${pathname}${search}` }).unwrap()
      window.location.assign(session.url)
    } catch {
      setLeaving(false)
    }
  }

  const failure = quoteError ?? sessionError
  return (
    <Modal
      open={Boolean(item)}
      onClose={stableClose}
      title={t('checkout.title')}
      description={description ?? t('checkout.description')}
      width={480}
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={leaving}>
            {t('checkout.cancel')}
          </Button>
          <Button onClick={handleContinue} loading={leaving} disabled={!quote}>
            {t('checkout.continue')}
          </Button>
        </>
      }
    >
      <div className={styles.body}>
        {isLoading && (
          <SkeletonRegion className={styles.summary}>
            <div>
              <p className={styles.itemName}>
                <Skeleton width={160} height={12} />
              </p>
              <p className={styles.caption}>
                <Skeleton width={110} />
              </p>
            </div>
            <Skeleton width={72} height={20} />
          </SkeletonRegion>
        )}
        {quote && (
          <div className={styles.summary} data-checkout-summary>
            <div>
              <p className={styles.itemName}>{quote.itemName}</p>
              <p className={styles.caption}>
                {t(quote.interval ? 'checkout.monthly' : 'checkout.oneTime', { currency: quote.currency })}
              </p>
            </div>
            <p className={styles.total}>{format.money(quote.amountMinor, quote.currency)}</p>
          </div>
        )}
        <p className={styles.note}>{t('checkout.note')}</p>
        <div role="alert">{failure && <p className={styles.failure}>{errorText.code(failure)}</p>}</div>
      </div>
    </Modal>
  )
}
