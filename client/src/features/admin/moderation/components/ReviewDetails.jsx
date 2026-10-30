import PillBadge from '@/components/common/PillBadge.jsx'
import { formatDate, formatDateTime } from '@/features/admin/audit-logs/utils/formatDate.js'
import styles from './ReviewDetails.module.css'

const NOT_PROVIDED = 'Not provided'

/** Body of the "Review reported content" dialog: a reported item, or a job opened from the Jobs list (`item.details`). */
export function ContentDetails({ item }) {
  const { details } = item
  return (
    <>
      <div className={styles.badges}>
        <PillBadge tone="accent">{item.kind}</PillBadge>
        <PillBadge tone={item.priority === 'high' ? 'warning' : 'neutral'}>
          {item.priority === 'high' ? 'High priority' : 'Standard priority'}
        </PillBadge>
      </div>
      <h3 className={styles.title}>{item.title}</h3>
      <p className={styles.subtitle}>
        {details
          ? 'Opened for review from the Jobs list. No report was filed for this listing.'
          : `${item.reason} · Reported ${formatDateTime(item.reportedAt)}`}
      </p>
      <div className={styles.context}>
        <p className={styles.eyebrow}>{details ? 'Listing details' : 'Report context'}</p>
        {details ? (
          <>
            <dl className={styles.facts}>
              <dt>Company</dt>
              <dd>{details.company || NOT_PROVIDED}</dd>
              <dt>Location</dt>
              <dd>{details.location || NOT_PROVIDED}</dd>
              <dt>Salary</dt>
              <dd>{details.salary || NOT_PROVIDED}</dd>
              <dt>Skills</dt>
              <dd>{details.skills.length > 0 ? details.skills.join(', ') : NOT_PROVIDED}</dd>
            </dl>
            <p className={styles.contextText}>{details.description || 'This listing has no description.'}</p>
          </>
        ) : (
          <p className={styles.contextText}>{item.summary}</p>
        )}
      </div>
      <p className={styles.notice}>
        No automated policy verdict is available. Review the content in context and apply documented marketplace rules
        consistently. Restricting a job pauses it; restricting the current candidate profile removes it from recruiter
        discovery.
      </p>
    </>
  )
}

/** Body of the "Review pending account" dialog. */
export function AccountDetails({ account }) {
  return (
    <>
      <h3 className={styles.accountName}>{account.name}</h3>
      <p className={styles.accountMeta}>
        {account.email} · {account.type} · Joined {formatDate(account.joinedAt)}
      </p>
      <p className={styles.accountNotice}>
        No automated risk assessment is available. Verify account details using your approved process before deciding.
        This action updates a demo record only.
      </p>
    </>
  )
}
