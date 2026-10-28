import { ShieldCheck, Sparkles } from 'lucide-react'

/** FAQ copy, verbatim from the Figma help frame. */
export const FAQS = [
  {
    id: 'matches-explained',
    question: 'How are matches explained?',
    answer:
      'We compare reviewed profile skills, experience, and stated work preferences with listed role requirements. Each insight shows evidence and possible gaps, rather than an absolute score. The current prototype uses local comparisons; semantic AI requires a connected service.',
  },
  {
    id: 'who-can-see',
    question: 'Who can see my profile and resume?',
    answer:
      'You control profile discovery and resume visibility in Settings. Applications require separate consent to share. This demo doesn’t upload or transmit your personal information.',
  },
  {
    id: 'edit-extracted',
    question: 'Can I edit extracted resume information?',
    answer:
      'Yes. Every detected field is editable before you confirm. You can edit your profile again at any time. Text extraction runs in your browser and may miss scanned text or unusual formatting.',
  },
  {
    id: 'ai-decisions',
    question: 'Does AI make hiring decisions?',
    answer:
      'No. Recommendations provide context for your review. Selecting, rejecting, contacting, and hiring people remain human decisions. Outreach drafts must be reviewed before saving.',
  },
  {
    id: 'live-marketplace',
    question: 'Is this a live recruitment marketplace?',
    answer:
      'This is an interactive product prototype with sample jobs, candidates, and locally saved activity. Real authentication, AI analysis, email delivery, messaging, and employer integrations need production services.',
  },
  {
    id: 'reset-demo',
    question: 'How do I reset my demo data?',
    answer:
      'Go to Settings → Data & account → Reset demo workspace. This restores sample data across the candidate, recruiter, and admin workspaces.',
  },
]

/**
 * The two resource cards under the FAQ. The labels come from the frame; the destinations are
 * the closest screen in each workspace (paths are relative to the workspace).
 */
export const HELP_LINKS = [
  {
    id: 'privacy',
    label: 'Privacy & data controls',
    icon: ShieldCheck,
    to: { candidate: 'settings/privacy', recruiter: 'settings/data-account', admin: 'audit-logs' },
  },
  {
    id: 'matches',
    label: 'Understand your matches',
    icon: Sparkles,
    to: { candidate: 'ai-insights', recruiter: 'find-candidates', admin: 'ai-matching' },
  },
]
