/** Recruiter notification preferences (mock). Persisted by NotificationsPage under this key. */
export const NOTIFICATIONS_STORAGE_KEY = 'lwm.recruiter.settings.notifications'

export const DEFAULT_NOTIFICATIONS = { inApp: true, email: true }

export const NOTIFICATION_OPTIONS = [
  {
    id: 'inApp',
    label: 'In-app notifications',
    description: 'Show a notification indicator when new recommendations are available.',
  },
  {
    id: 'email',
    label: 'Email alerts',
    description:
      'Your preference for job digests and application updates. Email delivery is not connected in this demo.',
  },
]
