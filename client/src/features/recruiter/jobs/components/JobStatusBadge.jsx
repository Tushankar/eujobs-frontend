import { useTranslation } from 'react-i18next'
import PillBadge from '@/components/common/PillBadge.jsx'

const TONES = { published: 'success', paused: 'warning', draft: 'neutral', closed: 'info' }

/** Status pill used by the jobs table, the overview roles table and job details; a restricted job says so (M-167). */
export default function JobStatusBadge({ status, restricted = false, className }) {
  const { t } = useTranslation()
  return (
    <PillBadge tone={restricted ? 'danger' : TONES[status]} dot className={className}>
      {restricted ? t('jobs:table.restricted') : t(`enums:jobStatus.${status}`)}
    </PillBadge>
  )
}
