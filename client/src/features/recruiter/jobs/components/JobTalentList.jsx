import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import { Avatar, Icon, Skeleton, SkeletonRegion } from '@/components/ui'
import PlanButton from '@/features/candidate/billing/components/PlanButton.jsx'
import { lacksEntitlement } from '@/features/candidate/billing/usePlan.js'
import { usePreferences } from '@/lib/preferences.js'
import { useGetRelevantTalentQuery } from '../api.js'
import styles from './JobTalentList.module.css'

const SKELETON_ROWS = 3

/**
 * "Discover relevant talent": the job's market sharing a required skill, by overlap (M-051 fallback, P4-D9). Without
 * Recruiter Plus a short upgrade prompt replaces the list (P11c-Q15).
 */
export default function JobTalentList({ jobId }) {
  const { t } = useTranslation()
  const { me } = usePreferences()
  const locked = lacksEntitlement(me, 'discovery', ['recruiter'])
  const { data, isLoading } = useGetRelevantTalentQuery(jobId, { skip: !me || locked })
  const talent = data?.items ?? []
  return (
    <>
      <h3 className={styles.heading}>{t('jobs:details.talent')}</h3>
      {locked ? (
        <div className={styles.locked}>
          <p className={styles.empty}>{t('discovery:locked.talent')}</p>
          <PlanButton variant="outline" size="sm" entitlement="discovery" roles={['recruiter']}>
            {t('discovery:locked.seeCandidates')}
          </PlanButton>
        </div>
      ) : isLoading || !me ? (
        <PeopleRowsSkeleton />
      ) : data && talent.length === 0 ? (
        <p className={styles.empty}>{t('jobs:details.talentEmpty')}</p>
      ) : (
        <ul className={styles.list}>
          {talent.map((person) => (
            <li key={person.id}>
              <Link to={`/recruiter/find-candidates/${person.id}?jobId=${jobId}`} className={styles.row} aria-label={t('jobs:details.openTalent', { name: person.fullName })}>
                <Avatar name={person.fullName} src={person.photoUrl ?? undefined} size={36} />
                <span className={styles.text}>
                  <span className={styles.name}>{person.fullName}</span>
                  <span className={styles.headline}>
                    {person.headline} · {t('jobs:details.years', { count: person.yearsExperience })}
                  </span>
                </span>
                <Icon as={ArrowUpRight} size={14} className={styles.arrow} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

/** Placeholder rows (avatar, name and headline, an optional stage pill) while a people list loads; also Job applicants. */
export function PeopleRowsSkeleton({ pill = false }) {
  return (
    <SkeletonRegion className={styles.list}>
      {Array.from({ length: SKELETON_ROWS }, (_, index) => (
        <div key={index} className={styles.row}>
          <Skeleton shape="circle" width={36} height={36} />
          <span className={styles.text}>
            <span className={styles.name}>
              <Skeleton width={[120, 96, 140][index]} />
            </span>
            <span className={styles.headline}>
              <Skeleton width={[200, 240, 180][index]} height={8} />
            </span>
          </span>
          {pill && <Skeleton shape="pill" width={76} height={20} />}
        </div>
      ))}
    </SkeletonRegion>
  )
}
