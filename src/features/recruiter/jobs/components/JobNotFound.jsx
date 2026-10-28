import { Link } from 'react-router-dom'
import { ArrowLeft, SearchX } from 'lucide-react'
import { Button, Icon } from '@/components/ui'
import styles from './JobNotFound.module.css'

/** Friendly empty state for a job id that is not in the store (details and edit routes). */
export default function JobNotFound() {
  return (
    <div className={styles.notFound}>
      <span className={styles.iconWrap}>
        <Icon as={SearchX} size={22} />
      </span>
      <h1 className={styles.title}>We couldn’t find that job</h1>
      <p className={styles.text}>It may have been removed, or the link may be incorrect. Your other jobs are still in the Jobs list.</p>
      <Button as={Link} to="/recruiter/jobs" leftIcon={<Icon as={ArrowLeft} size={13} />}>
        Back to jobs
      </Button>
    </div>
  )
}
