import { useGetCountriesQuery } from '@/app/api.js'
import { usePreferences } from '@/lib/preferences.js'
import { useGetPlansQuery } from './api.js'

/** The Checkout item of each role's paid plan: Plus (M-124) and Recruiter Plus (§3.22). */
export const planItem = (role) => ({ kind: 'subscription', itemId: role === 'recruiter' ? 'recruiter_plus' : 'plus' })

/**
 * True when `me` has one of `roles` and lacks the entitlement (M-118 lock chips, §3.22). Entitlement keys belong to
 * one role's plan, so candidate keys (the default) never lock a recruiter; recruiter locks pass `['recruiter']`.
 */
export const lacksEntitlement = (me, entitlement, roles = ['candidate']) => roles.includes(me?.role) && !me.entitlements?.includes(entitlement)

/**
 * §3.3, §3.22 for the UI: plan and entitlements come from /me. Candidate plan cards are priced in the header
 * country's currency (M-130, P5-Q5); a recruiter's in the company country's, which the server picks (P11c-Q2).
 * `plus` is the role's paid plan, `free` what the role keeps without it.
 */
export function usePlan() {
  const { me } = usePreferences()
  const recruiter = me?.role === 'recruiter'
  const { data: countries } = useGetCountriesQuery(undefined, { skip: recruiter })
  const currency = recruiter ? undefined : (countries?.find((country) => country.code === me?.pickerCountry)?.currency ?? 'EUR')
  const { data: plans = [] } = useGetPlansQuery(currency, { skip: !['candidate', 'recruiter'].includes(me?.role) || (!recruiter && !countries) })
  const item = planItem(me?.role)
  const plus = plans.find((plan) => plan.key === item.itemId)
  const free = plans.find((plan) => plan !== plus)
  return { isPlus: Boolean(me?.plan) && me.plan !== 'free', plans, plus, free, item }
}
