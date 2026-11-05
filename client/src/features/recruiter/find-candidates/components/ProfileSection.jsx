import { Panel, Skeleton } from '@/components/ui'
import styles from './ProfileSection.module.css'

/** White content card under the profile tabs (28px padding). Pages put `SectionTitle`s and text inside it. */
export default function ProfileSection({ labelledBy, children }) {
  return (
    <Panel padding={28} className={styles.section} aria-labelledby={labelledBy}>
      {children}
    </Panel>
  )
}

/** A tab's content card while the profile loads: two titled blocks of text lines. */
export function ProfileSectionSkeleton() {
  return (
    <Panel as="div" padding={28} className={styles.section} aria-hidden="true">
      <div className={styles.skeleton}>
        <Skeleton width={200} height={18} />
        <Skeleton />
        <Skeleton />
        <Skeleton width="70%" />
        <Skeleton width={160} height={18} className={styles.skeletonTitle} />
        <Skeleton width="45%" />
        <Skeleton width="85%" />
        <Skeleton width="60%" />
      </div>
    </Panel>
  )
}
