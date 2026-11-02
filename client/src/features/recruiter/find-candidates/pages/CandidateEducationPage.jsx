import { useTranslation } from 'react-i18next'
import { useOutletContext } from 'react-router-dom'
import { GraduationCap } from 'lucide-react'
import { Icon } from '@/components/ui'
import SectionTitle from '@/components/common/SectionTitle.jsx'
import ProfileSection from '../components/ProfileSection.jsx'
import { useCandidateText } from '../utils/candidateText.js'
import styles from './CandidateEducationPage.module.css'

/** Education tab (M-019, M-026): institution, degree and dates, newest first. */
export default function CandidateEducationPage() {
  const { t } = useTranslation()
  const text = useCandidateText()
  const { candidate } = useOutletContext()

  return (
    <ProfileSection labelledBy="education-title">
      <SectionTitle id="education-title" title={t('discovery:educationTab.title')} />
      {candidate.education.length === 0 && <p className={styles.note}>{t('discovery:educationTab.empty')}</p>}
      {candidate.education.map((entry) => (
        <div key={`${entry.institution}-${entry.start}`} className={styles.entry}>
          <Icon as={GraduationCap} size={22} strokeWidth={2} className={styles.icon} />
          <div>
            <h3 className={styles.degree}>{entry.degree}</h3>
            <p className={styles.meta}>
              {entry.institution} · {text.period(entry.start, entry.end, entry.stillStudying)}
            </p>
          </div>
        </div>
      ))}
      <p className={styles.note}>{t('discovery:educationTab.note')}</p>
    </ProfileSection>
  )
}
