import PillBadge from '@/components/common/PillBadge.jsx'
import { JOB_STATUSES } from '../data/jobs.js'

const TONES = { published: 'success', paused: 'warning', draft: 'neutral', closed: 'info' }

/** Status pill used by the jobs table, the overview roles table and job details. */
export default function JobStatusBadge({ status, className }) {
  return (
    <PillBadge tone={TONES[status]} dot className={className}>
      {JOB_STATUSES[status].label}
    </PillBadge>
  )
}
