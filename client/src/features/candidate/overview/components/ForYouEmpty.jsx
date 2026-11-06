import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import { Link } from 'react-router-dom'
import { ArrowRight, Bell, Check, ChevronRight, Crown } from 'lucide-react'
import { openUpgrade } from '@/app/upgrade.js'
import aiGlyph from '@/assets/icons/ai-glyph-blue.svg'
import { Button, Icon, Skeleton, SkeletonRegion } from '@/components/ui'
import { usePlan } from '@/features/candidate/billing/usePlan.js'
import { useSearchJobsQuery } from '@/features/candidate/jobs/api.js'
import JobCard, { JobCardSkeleton } from '@/features/candidate/jobs/components/JobCard.jsx'
import { useFormat, usePreferences } from '@/lib/preferences.js'
import styles from './ForYouEmpty.module.css'

const NEWEST = 2
const NEXT_ITEMS = 3
const PLUS_POINTS = ['scores', 'reasons', 'alerts']

/** What to do next, from the account: finish the profile, then Plus for AI matching, then job alerts. */
function NextStep({ me, isPlus, plus }) {
  const { t } = useTranslation()
  const format = useFormat()
  const dispatch = useDispatch()
  const { completeness } = me
  const browse = (
    <Button as={Link} to="/candidate/jobs" variant="outline">
      {t('findJobs:forYou.browse')}
    </Button>
  )

  if (!completeness.complete) {
    const next = completeness.items.filter((item) => !item.done).slice(0, NEXT_ITEMS)
    return (
      <section className={styles.card} data-for-you="profile">
        <h3 className={styles.title}>
          <img src={aiGlyph} alt="" width={18} height={18} />
          {t('findJobs:forYou.profile.title')}
        </h3>
        <p className={styles.text}>{t('findJobs:forYou.profile.text')}</p>
        <div className={styles.meter}>
          <span className={styles.bar} aria-hidden="true">
            <span style={{ width: `${completeness.percent}%` }} />
          </span>
          <span className={styles.meterText}>
            <strong>{format.number(completeness.percent / 100, { style: 'percent' })}</strong> · {t('completeness:progress', { done: completeness.done, total: completeness.total })}
          </span>
        </div>
        <ul className={styles.todo}>
          {next.map((item) => (
            <li key={item.key}>
              <Link to={item.route} className={styles.todoRow}>
                <span className={styles.dashed} aria-hidden="true" />
                <span>{t(`completeness:items.${item.key}`)}</span>
                <Icon as={ChevronRight} size={14} className={styles.chevron} />
              </Link>
            </li>
          ))}
        </ul>
        <div className={styles.actions}>
          <Button as={Link} to="/candidate/profile" rightIcon={<Icon as={ArrowRight} size={14} />}>
            {t('findJobs:forYou.profile.action')}
          </Button>
          {browse}
        </div>
      </section>
    )
  }

  if (!isPlus) {
    return (
      <section className={styles.card} data-for-you="plus">
        <div className={styles.titleRow}>
          <h3 className={styles.title}>
            <Icon as={Crown} size={17} strokeWidth={2} className={styles.crown} />
            {t('findJobs:forYou.plus.title', { plan: plus?.name ?? t('enums:planKey.plus') })}
          </h3>
          {plus?.price && (
            <p className={styles.price}>
              <strong>{format.money(plus.price.amountMinor, plus.price.currency)}</strong> {t('billing:perMonth')}
            </p>
          )}
        </div>
        <p className={styles.text}>{t('findJobs:forYou.plus.text', { plan: plus?.name ?? t('enums:planKey.plus') })}</p>
        <ul className={styles.points}>
          {PLUS_POINTS.map((key) => (
            <li key={key}>
              <Icon as={Check} size={15} strokeWidth={2.2} className={styles.check} />
              {t(`findJobs:forYou.plus.points.${key}`)}
            </li>
          ))}
        </ul>
        <div className={styles.actions}>
          <Button onClick={() => dispatch(openUpgrade('ai'))} rightIcon={<Icon as={ArrowRight} size={14} />}>
            {t('findJobs:forYou.plus.action', { plan: plus?.name ?? t('enums:planKey.plus') })}
          </Button>
          {browse}
        </div>
      </section>
    )
  }

  return (
    <section className={styles.card} data-for-you="alerts">
      <h3 className={styles.title}>
        <img src={aiGlyph} alt="" width={18} height={18} />
        {t('findJobs:forYou.alerts.title')}
      </h3>
      <p className={styles.text}>{t('findJobs:forYou.alerts.text')}</p>
      <div className={styles.actions}>
        <Button as={Link} to="/candidate/job-alerts" leftIcon={<Icon as={Bell} size={14} />}>
          {t('findJobs:forYou.alerts.action')}
        </Button>
        {browse}
      </div>
    </section>
  )
}

/**
 * "For you" with no matches (Overview): the next step for this account (complete the profile; on Free, Plus for AI
 * matching; on Plus, job alerts), then the newest open roles in the header country so the list is never empty.
 */
export default function ForYouEmpty({ onToggleSave }) {
  const { t } = useTranslation()
  const format = useFormat()
  const { me } = usePreferences()
  const { isPlus, plus, loading } = usePlan()
  // The same request as the "Recently added" tab, so switching to it is instant.
  const { data: newest, isLoading } = useSearchJobsQuery({ sort: 'newest' })
  const country = newest?.view.country
  const place = country === 'REMOTE' ? t('findJobs:forYou.remote') : country && format.country(country)

  return (
    <div className={styles.wrap}>
      {!me || loading ? (
        <SkeletonRegion className={styles.card}>
          <Skeleton width={240} height={20} />
          <Skeleton width="80%" />
          <Skeleton width="60%" />
          <Skeleton shape="pill" width={180} height={40} />
        </SkeletonRegion>
      ) : (
        <NextStep me={me} isPlus={isPlus} plus={plus} />
      )}

      {(isLoading || newest?.items.length > 0) && (
        <div className={styles.newest}>
          <div className={styles.newestHead}>
            <h3 className={styles.newestTitle}>{place ? t('findJobs:forYou.newest', { place }) : <Skeleton width={160} />}</h3>
            {newest && <span className={styles.newestCount}>{t('findJobs:forYou.openRoles', { count: newest.total })}</span>}
          </div>
          {isLoading ? (
            <SkeletonRegion className={styles.jobs}>
              {Array.from({ length: NEWEST }, (_, index) => (
                <JobCardSkeleton key={index} />
              ))}
            </SkeletonRegion>
          ) : (
            <div className={styles.jobs}>
              {newest.items.slice(0, NEWEST).map((job) => (
                <JobCard key={job.id} job={job} onToggleSave={onToggleSave} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
