import { useCallback } from 'react'
import { useSharedLocalStorage } from '@/hooks/useSharedLocalStorage.js'
import { INITIAL_SUBSCRIPTION, SUBSCRIPTION_STORAGE_KEY } from '../data/subscription.js'

/** The candidate's plan, shared by the plan step, the Plus gate and the Billing tab so they change together. */
export function useSubscription() {
  const [subscription, setSubscription] = useSharedLocalStorage(SUBSCRIPTION_STORAGE_KEY, INITIAL_SUBSCRIPTION)

  const setPlan = useCallback(
    (plan, paymentId) =>
      setSubscription({ plan, status: 'active', startedAt: new Date().toISOString(), ...(paymentId && { paymentId }) }),
    [setSubscription],
  )

  return { subscription, plan: subscription?.plan ?? 'free', isPlus: subscription?.plan === 'plus', setPlan }
}
