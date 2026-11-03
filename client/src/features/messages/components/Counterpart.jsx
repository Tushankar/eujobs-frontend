import { useTranslation } from 'react-i18next'
import { Avatar, CompanyLogo } from '@/components/ui'
import styles from './Counterpart.module.css'

/**
 * The other party of a thread: the company (logo) for a candidate, the candidate (photo, headline) for a recruiter,
 * with the job the thread is about. Nothing about the candidate's plan is ever shown (M-087).
 */
export default function Counterpart({ conversation, role, size = 40 }) {
  const { t } = useTranslation()
  const { counterpart, job } = conversation
  const name = counterpart?.name ?? t('messages:deletedUser')
  const details = [role === 'recruiter' ? counterpart?.headline : null, job?.title && t('messages:about', { job: job.title })].filter(Boolean).join(' · ')
  return (
    <span className={styles.root}>
      {role === 'candidate' ? (
        <CompanyLogo name={name} id={counterpart?.id ?? name} src={counterpart?.imageUrl ?? undefined} size={size} />
      ) : (
        <Avatar name={name} src={counterpart?.imageUrl ?? undefined} size={size} />
      )}
      <span className={styles.text}>
        <span className={styles.name}>{name}</span>
        {details && <span className={styles.details}>{details}</span>}
      </span>
    </span>
  )
}
