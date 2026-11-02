import { useTranslation } from 'react-i18next'
import { useJobText } from '@/lib/jobText.js'
import { useFormat } from '@/lib/preferences.js'
import styles from './JobPosting.module.css'

function SkillGroup({ title, skills }) {
  if (!skills?.length) return null
  return (
    <>
      <h3 className={styles.heading}>{title}</h3>
      <ul className={styles.skills}>
        {skills.map((skill) => (
          <li key={skill} className={styles.skill}>
            {skill}
          </li>
        ))}
      </ul>
    </>
  )
}

/** The body of a job posting (brief, responsibilities, skills, languages, eligibility); Job details and the wizard preview. */
export default function JobPosting({ job }) {
  const { t } = useTranslation()
  const format = useFormat()
  const jobText = useJobText()
  const eligible = jobText.eligible(job)
  return (
    <>
      <p className={styles.brief}>{job.brief || t('jobs:posting.noBrief')}</p>
      {job.responsibilities?.length > 0 && (
        <>
          <h3 className={styles.heading}>{t('jobs:posting.responsibilities')}</h3>
          <ul className={styles.responsibilities}>
            {job.responsibilities.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </>
      )}
      <SkillGroup title={t('jobs:posting.requiredSkills')} skills={job.requiredSkills} />
      <SkillGroup title={t('jobs:posting.preferredSkills')} skills={job.preferredSkills} />
      <SkillGroup
        title={t('jobs:posting.languages')}
        skills={job.requiredLanguages
          ?.filter((language) => language.code)
          .map((language) => t('jobs:posting.languageLevel', { language: format.languageName(language.code), level: t(`enums:languageLevel.${language.minLevel}`) }))}
      />
      {(eligible || job.visaSponsorship) && (
        <ul className={styles.skills}>
          {eligible && <li className={styles.skill}>{t('jobs:posting.eligible', { countries: eligible })}</li>}
          {job.visaSponsorship && <li className={styles.skill}>{t('jobs:posting.visa')}</li>}
        </ul>
      )}
    </>
  )
}
