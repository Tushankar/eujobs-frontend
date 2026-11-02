import { useGetCountriesQuery } from '@/app/api.js'
import { usePreferences } from '@/lib/preferences.js'
import { useGetPlansQuery } from './api.js'

/** The Checkout item of the Plus plan (M-124). */
export const PLUS_ITEM = { kind: 'subscription', itemId: 'plus' }

/** True when `me` is a candidate without the entitlement (M-118 lock chips); other roles have no plan (M-117). */
export const lacksEntitlement = (me, entitlement) => me?.role === 'candidate' && !me.entitlements?.includes(entitlement)

/**
 * §3.3 for the UI: plan and entitlements come from /me; the plan cards are priced in the header country's currency,
 * which is also what Checkout charges (M-130, P5-Q5).
 */
export function usePlan() {
  const { me } = usePreferences()
  const { data: countries } = useGetCountriesQuery()
  const currency = countries?.find((country) => country.code === me?.pickerCountry)?.currency ?? 'EUR'
  const { data: plans = [] } = useGetPlansQuery(currency, { skip: me?.role !== 'candidate' || !countries })
  return { isPlus: me?.plan === 'plus', plans, plus: plans.find((plan) => plan.key === 'plus') }
}
