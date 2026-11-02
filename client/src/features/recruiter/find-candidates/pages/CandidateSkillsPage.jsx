import { useTranslation } from 'react-i18next'
import { useOutletContext } from 'react-router-dom'
import PillBadge from '@/components/common/PillBadge.jsx'
import SectionTitle from '@/components/common/SectionTitle.jsx'
import { useFormat } from '@/lib/preferences.js'
import ProfileSection from '../components/ProfileSection.jsx'
import styles from './CandidateSkillsPage.module.css'

/** Skills tab (M-026): listed skills, languages with level, and certificates ("Verified" only when reviewed, M-025). */
export default function CandidateSkillsPage() {
  const { t } = useTranslation()
  const format = useFormat()
  const { candidate } = useOutletContext()

  return (
    <ProfileSection labelledBy="skills-title">
      <SectionTitle id="skills-title" title={t('discovery:skillsTab.title')} />
      <ul className={styles.list}>
        {candidate.skills.map((skill) => (
          <li key={skill} className={styles.skill}>
            <span className={styles.name}>{skill}</span>
            <PillBadge tone="accent">{t('discovery:skillsTab.provided')}</PillBadge>
          </li>
        ))}
      </ul>
      <p className={styles.note}>{t('discovery:skillsTab.note')}</p>

      <SectionTitle className={styles.section} title={t('discovery:skillsTab.languages')} />
      <ul className={styles.list}>
        {candidate.languages.map((language) => (
          <li key={language.code} className={styles.skill}>
            <span className={styles.name}>{format.languageName(language.code)}</span>
            <PillBadge>{t(`enums:languageLevel.${language.level}`)}</PillBadge>
          </li>
        ))}
      </ul>

      <SectionTitle className={styles.section} title={t('discovery:skillsTab.certificates')} />
      {candidate.certificates.length === 0 ? (
        <p className={styles.note}>{t('discovery:skillsTab.noCertificates')}</p>
      ) : (
        <ul className={styles.list}>
          {candidate.certificates.map((certificate) => (
            <li key={certificate.name} className={styles.skill}>
              <span className={styles.name}>
                {certificate.name} · {certificate.issuer}
              </span>
              {certificate.verified && <PillBadge tone="success">{t('discovery:skillsTab.certificateVerified')}</PillBadge>}
            </li>
          ))}
        </ul>
      )}
    </ProfileSection>
  )
}
