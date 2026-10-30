/** Copy for Settings > Data & account (verbatim from the Figma frame). */
export const DATA_NOTICE =
  'This interactive prototype stores reviewed profile fields and workspace activity in this browser. Original resume files are processed locally and are not saved; version history contains file names and reviewed profile snapshots only. No real account or server-side data exists.'

export const PRIVACY_STORAGE_KEY = 'lwm.candidate.settings.privacy'
export const NOTIFICATIONS_STORAGE_KEY = 'lwm.candidate.settings.notifications'

export const DEFAULT_PRIVACY = { discoverable: true, resumeVisible: false, matchingConsent: true }
export const DEFAULT_NOTIFICATIONS = { inApp: true, email: true }

export const PRIVACY_OPTIONS = [
  {
    id: 'discoverable',
    label: 'Profile visibility & recruiter discovery',
    description:
      'Allow recruiters to find your profile, listed skills, and career preferences. Turn this off to keep your profile private.',
  },
  {
    id: 'resumeVisible',
    label: 'Resume visibility',
    description:
      'Allow a resume reference to appear on your discoverable profile. Individual job applications still require your consent.',
  },
  {
    id: 'matchingConsent',
    label: 'Matching consent',
    description:
      'Allow your reviewed profile fields to be used in evidence-led matching. No protected characteristics are used.',
  },
]

export const NOTIFICATION_OPTIONS = [
  {
    id: 'inApp',
    label: 'In-app notifications',
    description: 'Show a notification indicator when new recommendations are available.',
  },
  {
    id: 'email',
    label: 'Email alerts',
    description: 'Your preference for job digests and application updates. Email delivery is not connected in this demo.',
  },
]
