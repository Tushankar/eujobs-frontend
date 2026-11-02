import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { closeUpgrade } from '@/app/upgrade.js'
import CheckoutDialog from '@/features/payments/components/CheckoutDialog.jsx'
import { PLUS_ITEM } from '../usePlan.js'

/**
 * The upgrade dialog every candidate page shares (M-118): opened by a 402 PLAN_REQUIRED, the promo card or Billing.
 * It is the Plus confirm step, naming the feature that was asked for when known.
 */
export default function UpgradeDialog() {
  const { t } = useTranslation('billing')
  const dispatch = useDispatch()
  const { open, entitlement } = useSelector((state) => state.upgrade)
  const description = entitlement ? t('upgrade.needs', { feature: t(`enums:entitlement.${entitlement}`) }) : t('upgrade.description')
  return <CheckoutDialog item={open ? PLUS_ITEM : null} description={description} onClose={() => dispatch(closeUpgrade())} />
}
