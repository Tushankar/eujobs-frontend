import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import { Avatar, Icon } from '@/components/ui'
import { useGetRelevantTalentQuery } from '../api.js'
import styles from './JobTalentList.module.css'

/** "Discover relevant talent": the job's market sharing a required skill, by overlap (M-051 fallback, P4-D9). */
export default function JobTalentList({ jobId }) {
  const { t } = useTranslation()
  const { data } = useGetRelevantTalentQuery(jobId)
  const talent = data?.items ?? []
  return (
    <>
      <h3 className={styles.heading}>{t('jobs:details.talent')}</h3>
      {data && talent.length === 0 ? (
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
