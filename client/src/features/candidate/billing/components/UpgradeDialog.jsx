import { isHiring } from '@/app/roles.js'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { closeUpgrade } from '@/app/upgrade.js'
import CheckoutDialog from '@/features/payments/components/CheckoutDialog.jsx'
import { usePreferences } from '@/lib/preferences.js'
import { planItem, usePaidPlanName, usePlan } from '../usePlan.js'

/**
 * The upgrade dialog every candidate and recruiter page shares (M-118, §3.22): opened by a 402 PLAN_REQUIRED, a locked
 * button, the promo card or Billing. It is the confirm step of the role's plan (Plus or Recruiter Plus), naming the
 * feature that was asked for when known.
 */
export default function UpgradeDialog() {
  const { t } = useTranslation('billing')
  const dispatch = useDispatch()
  const { me } = usePreferences()
  const { open, entitlement } = useSelector((state) => state.upgrade)
  const keys = isHiring(me?.role) ? { needs: 'recruiter.upgradeNeeds', all: 'recruiter.upgradeDescription' } : { needs: 'upgrade.needs', all: 'upgrade.description' }
  // 2026-11-23: hiring texts name the role's own plan (Recruiter Plus or Agency Plus).
  const plan = usePaidPlanName()
  const description = entitlement ? t(keys.needs, { feature: t(`enums:entitlement.${entitlement}`), plan }) : t(keys.all, { plan })
  // P11d-Q9: the dialog lists what the plan includes, from its plan record.
  const { plus } = usePlan()
  return <CheckoutDialog item={open ? planItem(me?.role) : null} description={description} plan={plus} onClose={() => dispatch(closeUpgrade())} />
}
