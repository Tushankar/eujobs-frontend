import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ChevronRight, ShieldCheck } from 'lucide-react'
import { Avatar, Icon, Skeleton, SkeletonRegion } from '@/components/ui'
import PillBadge from '@/components/common/PillBadge.jsx'
import { CATEGORY_ICONS, SUBMISSION_TONES } from '@/features/admin/shared/tones.js'
import { useFormat } from '@/lib/preferences.js'
import styles from './CandidateSubmissions.module.css'

/* Submissions per placeholder candidate. */
const SKELETON_GROUPS = [2, 1, 1]

/** The verification queue while it loads: candidates (photo, name, email) over their submission rows. */
export function SubmissionsSkeleton() {
  return (
    <SkeletonRegion>
      <ul>
        {SKELETON_GROUPS.map((count, group) => (
          <li key={group} className={styles.card}>
            <div className={styles.person}>
              <Skeleton shape="circle" />
              <div className={styles.who}>
                <p className={styles.name}>
                  <Skeleton width={140} height={14} />
                </p>
                <p className={styles.email}>
                  <Skeleton width={180} />
                </p>
              </div>
              <Skeleton width={72} />
            </div>
            <ul className={styles.items}>
              {Array.from({ length: count }, (_, index) => (
                <li key={index} className={styles.item}>
                  <Skeleton shape="circle" width={16} height={16} />
                  <div className={styles.text}>
                    <p className={styles.what}>
                      <Skeleton width={160} height={12} />
                    </p>
                    <p className={styles.when}>
                      <Skeleton width={120} />
                    </p>
                  </div>
                  <Skeleton shape="pill" />
                  <Skeleton shape="pill" width={84} height={32} />
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </SkeletonRegion>
  )
}

/** One candidate in the verification queue: who they are, then each of their submissions on its own aligned row. */
export default function CandidateSubmissions({ candidate, items, basePath }) {
  const { t } = useTranslation()
  const format = useFormat()
  const name = candidate?.fullName ?? ''
  return (
    <li className={styles.card} data-candidate={candidate?.id}>
      <div className={styles.person}>
        <Avatar name={name} src={candidate?.photoUrl ?? undefined} size={40} />
        <div className={styles.who}>
          <h3 className={styles.name}>{name}</h3>
          {candidate?.email && <p className={styles.email}>{candidate.email}</p>}
        </div>
        <span className={styles.count}>{t('moderation:verification.count', { count: items.length })}</span>
      </div>
      <ul className={styles.items}>
        {items.map((item) => (
          <li key={item.id} className={styles.item} data-submission={item.id}>
            <span className={styles.icon}>
              <Icon as={CATEGORY_ICONS[item.category] ?? ShieldCheck} size={16} />
            </span>
            <div className={styles.text}>
              <p className={styles.what}>
                {[t(`enums:verificationCategory.${item.category}`), item.evidenceType && t(`enums:evidenceType.${item.evidenceType}`)].filter(Boolean).join(' · ')}
              </p>
              <p className={styles.when}>{t('moderation:verification.submitted', { date: format.dateTime(item.submittedAt) })}</p>
            </div>
            <PillBadge tone={SUBMISSION_TONES[item.status]}>{t(`enums:verificationStatus.${item.status}`)}</PillBadge>
            <Link to={`${basePath}/${item.id}`} className={styles.review}>
              {t('moderation:verification.review')}
              <Icon as={ChevronRight} size={14} />
            </Link>
          </li>
        ))}
      </ul>
    </li>
  )
}
