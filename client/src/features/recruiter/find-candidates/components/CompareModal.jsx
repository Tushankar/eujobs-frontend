import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Avatar, Modal } from '@/components/ui'
import { useFormat } from '@/lib/preferences.js'
import { useCandidateText } from '../utils/candidateText.js'
import styles from './CompareModal.module.css'

/** Side-by-side listed facts for the ticked candidates (A: recruiter A15, B2). Facts only: no ranking, no score. */
export default function CompareModal({ open, onClose, candidates, job }) {
  const { t } = useTranslation()
  const format = useFormat()
  const text = useCandidateText()
  const none = t('discovery:compare.none')
  // The job's country decides the right-to-work row; a remote job has none, so every entry is listed.
  const jobCountry = job?.country && job.country !== 'REMOTE' ? job.country : null
  const rows = [
    { key: 'currentRole', value: (candidate) => text.role(candidate.currentRole) || candidate.headline },
    { key: 'experience', value: (candidate) => t('discovery:card.years', { count: candidate.yearsExperience }) },
    { key: 'workPreference', value: (candidate) => candidate.workPreference && t(`enums:workPreference.${candidate.workPreference}`) },
    { key: 'location', value: (candidate) => text.location(candidate) },
    { key: 'availability', value: (candidate) => t(`enums:availability.${candidate.availability}`) },
    ...(job ? [{ key: 'relevant', label: t('discovery:compare.rows.relevant', { job: job.title }), value: (candidate) => format.list(candidate.overlap?.matched ?? []) }] : []),
    { key: 'skills', value: (candidate) => format.list(candidate.skills) },
    { key: 'languages', value: (candidate) => text.languages(candidate) },
    {
      key: 'rightToWork',
      label: jobCountry ? t('discovery:compare.rows.rightToWork', { country: format.country(jobCountry) }) : t('discovery:compare.rows.rightToWorkAny'),
      value: (candidate) =>
        jobCountry
          ? text.rightToWork(candidate, jobCountry)
          : candidate.rightToWork.map((entry) => `${t(`enums:rtwRegion.${entry.region}`)} · ${t(`enums:rtwStatus.${entry.status}`)}`).join(', '),
    },
    { key: 'verification', value: (candidate) => text.verification(candidate) },
    {
      key: 'latestEmployer',
      value: (candidate) => candidate.currentRole && `${candidate.currentRole.employer} · ${text.period(candidate.currentRole.start, candidate.currentRole.end, candidate.currentRole.current)}`,
    },
    { key: 'education', value: (candidate) => candidate.latestEducation && `${candidate.latestEducation.degree} · ${candidate.latestEducation.institution}` },
    { key: 'certificates', value: (candidate) => format.list(candidate.certificates.map((certificate) => certificate.name)) },
  ]

  return (
    <Modal open={open} onClose={onClose} title={t('discovery:compare.title')} description={t('discovery:compare.description')} width={880}>
      <div className={styles.scroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <td />
              {candidates.map((candidate) => (
                <th key={candidate.id} scope="col" className={styles.person}>
                  <Avatar name={candidate.fullName} src={candidate.photoUrl ?? undefined} size={40} />
                  <Link to={`/recruiter/find-candidates/${candidate.id}`} className={styles.name}>
                    {candidate.fullName}
                  </Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <th scope="row" className={styles.label}>
                  {row.label ?? t(`discovery:compare.rows.${row.key}`)}
                </th>
                {candidates.map((candidate) => (
                  <td key={candidate.id} className={styles.cell}>
                    {row.value(candidate) || none}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  )
}
