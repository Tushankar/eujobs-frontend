import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Outlet, useMatches } from 'react-router-dom'
import { Check } from 'lucide-react'
import { Button, Icon, Panel } from '@/components/ui'
import PageTitle from '@/components/common/PageTitle.jsx'
import CheckoutDialog from '@/features/payments/components/CheckoutDialog.jsx'
import { useFormat, usePreferences } from '@/lib/preferences.js'
import { lacksEntitlement, usePlan } from '../usePlan.js'
import styles from './RequirePlan.module.css'

/**
 * Route layout for paid pages of candidates and recruiters (M-118, A: shared §8.3, §3.22): the entitlement comes from the
 * route's `handle.entitlement`.
 * With it the pages render; without it, the upgrade card. The server enforces the same rule (402 PLAN_REQUIRED).
 */
export default function RequirePlan() {
  const { me } = usePreferences()
  const entitlement = useMatches().findLast((match) => match.handle?.entitlement)?.handle.entitlement
  return lacksEntitlement(me, entitlement, [me?.role]) ? <PlanGate entitlement={entitlement} /> : <Outlet />
}

/** The upgrade card of a locked page, with the role's plan and its price (Plus: the header country's currency). */
export function PlanGate({ entitlement }) {
  const { t } = useTranslation('billing')
  const format = useFormat()
  const { me } = usePreferences()
  const { plus, item } = usePlan()
  const [checkingOut, setCheckingOut] = useState(false)

  return (
    <>
      <PageTitle eyebrow={plus?.name} title={t(`gate.${entitlement}.title`)} description={t(`gate.${entitlement}.lead`)} />
      <Panel padding={28} className={styles.card} data-plan-gate={entitlement}>
        {plus?.price && (
          <p className={styles.price}>
            {format.money(plus.price.amountMinor, plus.price.currency)} <span>{t('perMonth')}</span>
          </p>
        )}
        <ul className={styles.features}>
          {plus?.features.map((feature) => (
            <li key={feature}>
              <Icon as={Check} size={14} /> {feature}
            </li>
          ))}
        </ul>
        <div className={styles.actions}>
          <Button onClick={() => setCheckingOut(true)}>
            {t('upgradeTo', { plan: plus?.name ?? '' })}
          </Button>
          <Button as={Link} to={`/${me.role}/settings/billing`} variant="secondary">
            {t('manageBilling')}
          </Button>
        </div>
      </Panel>
      <CheckoutDialog item={checkingOut ? item : null} onClose={() => setCheckingOut(false)} />
    </>
  )
}
