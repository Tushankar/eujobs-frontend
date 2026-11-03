import { useTranslation } from 'react-i18next'
import StatusBadge from '@/components/common/StatusBadge.jsx'
import { useFormat } from '@/lib/preferences.js'

const TONES = { strong: 'success', good: 'info' }

/**
 * Plus candidates with matching consent see the match score and its label (M-047, C6); everyone else, and jobs
 * without a score, the skill-overlap label (M-050, M-052).
 */
export default function MatchBadge({ job }) {
  const { t } = useTranslation()
  const format = useFormat()
  if (!job.match) {
    return <StatusBadge tone={job.overlap.count > 0 ? 'info' : 'neutral'} data-match-badge>{t('findJobs:card.overlap', { count: job.overlap.count, total: job.overlap.total })}</StatusBadge>
  }
  const score = format.number(job.match.score / 100, { style: 'percent' })
  return (
    <StatusBadge tone={TONES[job.match.label] ?? 'neutral'} data-match-badge>
      {job.match.label ? t('findJobs:card.score', { score, label: t(`enums:matchLabel.${job.match.label}`) }) : t('findJobs:card.scoreOnly', { score })}
    </StatusBadge>
  )
}
