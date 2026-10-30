/** Copy for Settings > Data & account (verbatim from the Figma frame). */
export const DATA_NOTICE =
  'This interactive prototype stores reviewed profile fields and workspace activity in this browser. Original resume files are processed locally and are not saved; version history contains file names and reviewed profile snapshots only. No real account or server-side data exists.'

// Data & account still reads the device-only privacy flags until Phase 12 (P3-D10); the Privacy page uses the server.
export const PRIVACY_STORAGE_KEY = 'lwm.candidate.settings.privacy'

export const DEFAULT_PRIVACY = { discoverable: true, resumeVisible: false, matchingConsent: true }
