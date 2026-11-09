import { useTranslation } from 'react-i18next'
import { Check } from 'lucide-react'
import { Icon, Skeleton, SkeletonRegion } from '@/components/ui'
import { isPaidPlan } from '@/lib/plans.js'
import { useFormat, usePreferences } from '@/lib/preferences.js'
import { cx } from '@/utils/cx.js'
import { useGetCvVersionsQuery } from '../../cv/api.js'
import { useGetProfileQuery } from '../../profile/api.js'
import styles from './SetupSummary.module.css'

const ROWS = ['cv', 'workMode', 'location', 'salary', 'plan']

/**
 * The side card of every onboarding step: what the candidate has set so far (live CV, work mode, city, minimum
 * salary, a paid plan), from the saved profile and CV, or from `draft` while the preferences form is being filled in.
 */
export default function SetupSummary({ draft }) {
  const { t } = useTranslation()
  const format = useFormat()
  const { me } = usePreferences()
  const { data: profile } = useGetProfileQuery()
  const { data: cv } = useGetCvVersionsQuery()

  if (!profile || !cv) {
    return (
      <SkeletonRegion className={styles.card}>
        <h2 className={styles.title}>{t('onboarding:summary.title')}</h2>
        {ROWS.map((row) => (
          <div key={row} className={styles.row}>
            <Skeleton shape="circle" width={22} height={22} />
            <span className={styles.text}>
              <Skeleton width={70} />
              <Skeleton width={120} />
            </span>
          </div>
        ))}
      </SkeletonRegion>
    )
  }

  const live = cv.items.find((version) => version.live)
  const { workPreference, place, salary } = draft ?? { workPreference: profile.workPreference, place: profile.location, salary: profile.salaryMin }
  const values = {
    cv: live?.originalName,
    workMode: workPreference && t(`enums:workPreference.${workPreference}`),
    location: place && t('common:city.value', { city: place.city, country: format.country(place.countryCode) }),
    salary: salary && t('profile:nextStep.salary', { amount: format.salary({ min: salary.amount, currency: salary.currency }), period: t(`enums:salaryPeriod.${salary.period}`) }),
    // A subscriber already has their plan; everyone else picks it on the last step.
    plan: isPaidPlan(me) ? t(`enums:planKey.${me.plan}`) : undefined,
  }
  const empty = { cv: 'notSet', workMode: 'notSet', location: 'notSet', salary: 'optional', plan: 'planNext' }

  return (
    <section className={styles.card} aria-labelledby="setup-summary">
      <h2 id="setup-summary" className={styles.title}>
        {t('onboarding:summary.title')}
      </h2>
      {ROWS.map((row) => {
        const value = values[row]
        return (
          <div key={row} className={styles.row} data-setup-row={row} data-done={Boolean(value) || undefined}>
            <span className={cx(styles.mark, value && styles.markDone)}>{value && <Icon as={Check} size={12} strokeWidth={3} />}</span>
            <span className={styles.text}>
              <span className={styles.label}>{t(`onboarding:summary.${row}`)}</span>
              <span className={cx(styles.value, !value && styles.valueEmpty)}>{value ?? t(`onboarding:summary.${empty[row]}`)}</span>
            </span>
          </div>
        )
      })}
      <p className={styles.note}>{t('onboarding:summary.note')}</p>
    </section>
  )
}
