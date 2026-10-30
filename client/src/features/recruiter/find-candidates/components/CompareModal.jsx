import { Link } from 'react-router-dom'
import { Modal } from '@/components/ui'
import { getMatchEvidence } from '../utils/matchEvidence.js'
import CandidateAvatar from './CandidateAvatar.jsx'
import styles from './CompareModal.module.css'

/** Side-by-side listed facts for the candidates ticked "Compare". Facts only: no ranking, no score. */
export default function CompareModal({ open, onClose, candidates, job }) {
  const rows = [
    { label: 'Current role', value: (candidate) => candidate.headline },
    { label: 'Experience', value: (candidate) => `${candidate.experienceYears} years` },
    { label: 'Work mode', value: (candidate) => candidate.workMode },
    { label: 'Location', value: (candidate) => candidate.location },
    { label: 'Availability', value: (candidate) => candidate.availability },
    ...(job
      ? [
          {
            label: `Skills relevant to ${job.title}`,
            value: (candidate) => getMatchEvidence(candidate, job).relevantSkills.join(', ') || 'None listed',
          },
        ]
      : []),
    { label: 'Listed skills', value: (candidate) => candidate.skills.join(', ') },
  ]

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Compare candidates"
      description="Listed profile facts side by side. Profile evidence, not a ranking or a hiring decision."
      width={880}
    >
      <div className={styles.scroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <td />
              {candidates.map((candidate) => (
                <th key={candidate.id} scope="col" className={styles.person}>
                  <CandidateAvatar candidate={candidate} size={40} />
                  <Link to={`/recruiter/find-candidates/${candidate.id}`} className={styles.name}>
                    {candidate.name}
                  </Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label}>
                <th scope="row" className={styles.label}>
                  {row.label}
                </th>
                {candidates.map((candidate) => (
                  <td key={candidate.id} className={styles.cell}>
                    {row.value(candidate)}
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
