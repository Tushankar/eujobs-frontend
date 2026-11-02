import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ArrowRight, ArrowUpRight } from 'lucide-react'
import { CompanyLogo, Icon } from '@/components/ui'
import StatusBadge from '@/components/common/StatusBadge.jsx'
import { useGetApplicationsQuery } from '@/features/candidate/applications/api.js'
import { canWithdraw, STATUS_TONES } from '@/features/candidate/applications/status.js'
import styles from './RailCards.module.css'

const SHOWN = 3

/** The latest three active applications, each linking to its job; the footer links to Applications. */
export default function ApplicationActivityCard() {
  const { t } = useTranslation()
  const { data } = useGetApplicationsQuery()
  const recent = (data?.items ?? []).filter((application) => canWithdraw(application.status)).slice(0, SHOWN)

  return (
    <section className={styles.card} data-card="application-activity">
      <div className={styles.head}>
        <h2 className={styles.activityTitle}>{t('applications:card.title')}</h2>
        <Link to="/candidate/applications" className={styles.openLink} aria-label={t('applications:card.open')}>
          <Icon as={ArrowUpRight} size={15} />
        </Link>
      </div>
      {data && recent.length === 0 ? (
        <p className={styles.lead}>{t('applications:card.empty')}</p>
      ) : (
        <ul className={styles.activityList}>
          {recent.map(({ id, job, status }) => (
            <li key={id}>
              <Link to={`/candidate/jobs/${job.id}`} className={styles.activityRow}>
                <CompanyLogo name={job.company.displayName} id={job.company.id} src={job.company.logoUrl ?? undefined} size={36} />
                <span className={styles.activityText}>
                  <span className={styles.activityRole}>{job.title}</span>
                  <span className={styles.activityCompany}>{job.company.displayName}</span>
                  <StatusBadge tone={STATUS_TONES[status]} className={styles.activityBadge}>
                    {t(`enums:applicationStatus.${status}`)}
                  </StatusBadge>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Link to="/candidate/applications" className={styles.trackLink}>
        {t('applications:card.track')}
        <Icon as={ArrowRight} size={11} />
      </Link>
    </section>
  )
}
