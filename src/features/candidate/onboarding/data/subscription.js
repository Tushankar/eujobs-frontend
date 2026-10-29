/** Prototype subscription choice made after profile completion. Stored on this device only. */
export const SUBSCRIPTION_STORAGE_KEY = 'lwm.candidate.subscription'

export const INITIAL_SUBSCRIPTION = null

export const PLANS = {
  free: { id: 'free', name: 'Free', price: '£0', period: 'forever', features: ['Browse and apply to jobs', 'Basic job matches'] },
  plus: {
    id: 'plus',
    name: 'AI Matches Plus',
    price: '£9',
    period: 'per month',
    features: ['AI job recommendations tuned to your profile', 'Match reasons and skill-gap guidance', 'Priority review of your CV versions'],
  },
}
