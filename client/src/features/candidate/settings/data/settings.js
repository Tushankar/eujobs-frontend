// Data & account still reads the device-only privacy flags until Phase 12 (P3-D10); the Privacy page uses the server.
export const PRIVACY_STORAGE_KEY = 'lwm.candidate.settings.privacy'

export const DEFAULT_PRIVACY = { discoverable: true, resumeVisible: false, matchingConsent: true }
