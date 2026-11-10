import { useTranslation } from 'react-i18next'
import { useOutletContext } from 'react-router-dom'
import PillBadge from '@/components/common/PillBadge.jsx'
import SectionTitle from '@/components/common/SectionTitle.jsx'
import { useFormat } from '@/lib/preferences.js'
import ProfileSection from '../components/ProfileSection.jsx'
import styles from './CandidateSkillsPage.module.css'

/**
 * Skills tab (M-026): listed skills, languages with level, certificates ("Verified" only when reviewed, M-025) and the
 * course certificates earned on EU Jobs (C24: shown wherever the profile is visible; they do not verify skills).
 */
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

      {/* Owner 2026-11-05: the courses the candidate takes or finished here, with progress (no payment details). */}
      <SectionTitle className={styles.section} title={t('discovery:skillsTab.courses')} />
      {candidate.courses.length === 0 ? (
        <p className={styles.note}>{t('discovery:skillsTab.noCourses')}</p>
      ) : (
        <ul className={styles.list} data-candidate-courses>
          {candidate.courses.map((course) => (
            <li key={course.courseId} className={styles.skill} data-candidate-course={course.courseId}>
              <span className={styles.name}>
                {course.title} · {course.category}
              </span>
              {course.completedAt ? (
                <PillBadge tone="success">{t('learning:myCourses.completed', { date: format.date(course.completedAt) })}</PillBadge>
              ) : (
                <PillBadge>{t('learning:myCourses.progress', { done: course.lessonsDone, total: course.lessonsTotal })}</PillBadge>
              )}
            </li>
          ))}
        </ul>
      )}

      <SectionTitle className={styles.section} title={t('discovery:skillsTab.courseCertificates')} />
      {candidate.courseCertificates.length === 0 ? (
        <p className={styles.note}>{t('discovery:skillsTab.noCourseCertificates')}</p>
      ) : (
        <ul className={styles.list} data-course-certificates>
          {candidate.courseCertificates.map((certificate) => (
            <li key={certificate.code} className={styles.skill} data-course-certificate={certificate.code}>
              <span className={styles.name}>
                {certificate.courseTitle} · {format.date(certificate.issuedAt)}
              </span>
              <a href={`/certificates/${certificate.code}`} target="_blank" rel="noopener">
                <PillBadge tone="success">{t('discovery:skillsTab.checkCertificate', { code: certificate.code })}</PillBadge>
              </a>
            </li>
          ))}
        </ul>
      )}
      <p className={styles.note}>{t('discovery:skillsTab.courseCertificatesNote')}</p>
    </ProfileSection>
  )
}
