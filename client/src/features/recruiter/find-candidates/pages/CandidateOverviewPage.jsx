import { useTranslation } from 'react-i18next'
import { useOutletContext } from 'react-router-dom'
import SectionTitle from '@/components/common/SectionTitle.jsx'
import { useFormat, usePreferences } from '@/lib/preferences.js'
import ProfileSection from '../components/ProfileSection.jsx'
import { useCandidateText } from '../utils/candidateText.js'
import styles from './CandidateOverviewPage.module.css'

/** Overview tab (M-026): the candidate's own words, the latest role, right to work (U27) and preferences. */
export default function CandidateOverviewPage() {
  const { t } = useTranslation()
  const format = useFormat()
  const { country } = usePreferences()
  const text = useCandidateText()
  const { candidate } = useOutletContext()
  const [current] = candidate.workHistory

  return (
    <ProfileSection labelledBy="overview-about">
      <SectionTitle id="overview-about" title={t('discovery:overviewTab.about')} />
      <p className={styles.about}>{candidate.about}</p>

      <SectionTitle className={styles.next} title={t('discovery:overviewTab.experience')} />
      {current ? (
        <div className={styles.role}>
          <h3 className={styles.roleTitle}>{current.title}</h3>
          <p className={styles.roleMeta}>
            {current.employer} · {text.period(current.start, current.end, current.current)}
          </p>
          {current.description && <p className={styles.roleSummary}>{current.description}</p>}
        </div>
      ) : (
        <p className={styles.nextStep}>{t('discovery:overviewTab.noExperience')}</p>
      )}

      <SectionTitle className={styles.next} title={t('discovery:overviewTab.rightToWork')} />
      <ul className={styles.rights}>
        {candidate.rightToWork.map((entry) => (
          <li key={entry.region}>
            {t(`enums:rtwRegion.${entry.region}`)} · {entry.status === 'visa_permit' && !entry.valid ? t('discovery:card.permitExpired') : t(`enums:rtwStatus.${entry.status}`)}
            {entry.permitExpiresOn && entry.valid && ` · ${t('discovery:overviewTab.validUntil', { date: format.date(entry.permitExpiresOn) })}`}
          </li>
        ))}
      </ul>
      {candidate.rightToWorkInView !== null && (
        <p className={styles.nextStep}>
          {t(candidate.rightToWorkInView ? 'discovery:overviewTab.rightToWorkIn' : 'discovery:overviewTab.noRightToWorkIn', { country: format.country(country) })}
        </p>
      )}

      <SectionTitle className={styles.next} title={t('discovery:overviewTab.preferences')} />
      <p className={styles.nextStep}>
        {t('discovery:overviewTab.preferencesText', {
          workPreference: t(`enums:workPreference.${candidate.workPreference}`).toLocaleLowerCase(),
          availability: t(`enums:availability.${candidate.availability}`),
        })}
      </p>
    </ProfileSection>
  )
}
