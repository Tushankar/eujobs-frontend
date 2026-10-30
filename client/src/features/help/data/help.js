import { ShieldCheck, Sparkles } from 'lucide-react'

/**
 * The two resource cards under the FAQ (labels: `help:links.<id>`). The destinations are the
 * closest screen in each workspace (paths are relative to the workspace).
 */
export const HELP_LINKS = [
  {
    id: 'privacy',
    icon: ShieldCheck,
    to: { candidate: 'settings/privacy', recruiter: 'settings/data-account', admin: 'audit-logs' },
  },
  {
    id: 'matches',
    icon: Sparkles,
    to: { candidate: 'ai-insights', recruiter: 'find-candidates', admin: 'ai-matching' },
  },
]
