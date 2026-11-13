import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'
import { Button, Modal, Skeleton, SkeletonRegion } from '@/components/ui'
import { useErrorText } from '@/lib/forms.js'
import { useFormat } from '@/lib/preferences.js'
import { useCreateCheckoutSessionMutation, useGetQuoteQuery } from '../api.js'
import styles from './CheckoutDialog.module.css'
import { cx } from '@/utils/cx.js'
import PlanFeatures from './PlanFeatures.jsx'

const CAPTION = { month: 'checkout.monthly', year: 'checkout.yearly' }

/**
 * The step before Stripe (M-124): the server's item, price and currency, then "Continue to secure payment" opens
 * Stripe's hosted Checkout. `item` = { kind, itemId, interval? } (null closes the dialog). A plan whose `plan` record
 * offers yearly billing can be switched between monthly and yearly here (2026-11-13; `item.interval` is the start).
 * Stripe returns to the role's return page and then to `from` (default: this page), or straight to `from` when the
 * buyer cancels (M-125).
 */
export default function CheckoutDialog({ item, from, description, plan, onClose }) {
  const { t } = useTranslation('billing')
  const format = useFormat()
  const errorText = useErrorText()
  const { pathname, search } = useLocation()
  const [interval, setInterval] = useState('month')
  const yearly = item?.kind === 'subscription' && plan?.yearlyPrice
  const request = item && (item.kind === 'subscription' ? { ...item, interval: yearly ? interval : 'month' } : item)
  const { data: quote, error: quoteError, isFetching } = useGetQuoteQuery(request, { skip: !item })
  const [createSession, { error: sessionError, reset }] = useCreateCheckoutSessionMutation()
  const failure = quoteError ?? sessionError
  const [leaving, setLeaving] = useState(false)
  // Each time the dialog opens for an item it starts clean, even when the same item is reopened.
  const [openedFor, setOpenedFor] = useState(null)
  const itemKey = item ? `${item.kind}:${item.itemId}:${item.interval ?? ''}` : null
  if (itemKey !== openedFor) {
    setOpenedFor(itemKey)
    setLeaving(false)
    setInterval(item?.interval ?? 'month')
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
      const session = await createSession({ ...request, from: from ?? `${pathname}${search}` }).unwrap()
      window.location.assign(session.url)
    } catch {
      setLeaving(false)
    }
  }

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
          <Button onClick={handleContinue} loading={leaving} disabled={!quote || isFetching}>
            {t('checkout.continue')}
          </Button>
        </>
      }
    >
      <div className={styles.body}>
        {yearly && (
          <div className={styles.periods} role="radiogroup" aria-label={t('checkout.period')}>
            {['month', 'year'].map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={interval === value}
                className={cx(styles.period, interval === value && styles.periodActive)}
                onClick={() => setInterval(value)}
                disabled={leaving}
                data-checkout-interval={value}
              >
                <span className={styles.periodName}>
                  {t(`interval.${value}`)}
                  {value === 'year' && <span className={styles.saving}>{t('interval.save', { percent: plan.yearlyPrice.savingPercent })}</span>}
                </span>
                <span className={styles.periodPrice}>
                  {value === 'year'
                    ? t('checkout.perYear', { price: format.money(plan.yearlyPrice.amountMinor, plan.yearlyPrice.currency) })
                    : t('checkout.perMonth', { price: format.money(plan.price.amountMinor, plan.price.currency) })}
                </span>
              </button>
            ))}
          </div>
        )}
        {!quote && !failure && (
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
                {t(CAPTION[quote.interval] ?? 'checkout.oneTime', { currency: quote.currency })}
              </p>
            </div>
            <p className={styles.total}>{format.money(quote.amountMinor, quote.currency)}</p>
          </div>
        )}
        {plan && <PlanFeatures plan={plan} />}
        <p className={styles.note}>{t('checkout.note')}</p>
        <div role="alert">{failure && <p className={styles.failure}>{errorText.code(failure)}</p>}</div>
      </div>
    </Modal>
  )
}
