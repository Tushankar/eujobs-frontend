import PillBadge from '@/components/common/PillBadge.jsx'
import { formatDate, formatDateTime } from '@/features/admin/audit-logs/utils/formatDate.js'
import styles from './ReviewDetails.module.css'

/** Body of the "Review reported content" dialog. */
export function ContentDetails({ item }) {
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
        {item.reason} · Reported {formatDateTime(item.reportedAt)}
      </p>
      <div className={styles.context}>
        <p className={styles.eyebrow}>Report context</p>
        <p className={styles.contextText}>{item.summary}</p>
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
