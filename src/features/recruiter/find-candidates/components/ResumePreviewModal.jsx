import { Button, Modal } from '@/components/ui'
import PillBadge from '@/components/common/PillBadge.jsx'
import { candidateDetails } from '../data/candidateDetails.js'
import styles from './ResumePreviewModal.module.css'

/** On-screen rendering of the candidate's live CV content (there is no PDF file in this demo). */
export default function ResumePreviewModal({ open, onClose, candidate }) {
  const { about, roles, education } = candidateDetails[candidate.id]

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Current live CV"
      description="Candidate-approved content shown on screen. This demo has no CV file."
      width={640}
      footer={
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      }
    >
      <article className={styles.cv}>
        <h3 className={styles.name}>{candidate.name}</h3>
        <p className={styles.headline}>
          {candidate.headline} · {candidate.location}
        </p>

        <h4 className={styles.heading}>Summary</h4>
        <p className={styles.text}>{about}</p>

        <h4 className={styles.heading}>Experience</h4>
        <ul className={styles.list}>
          {roles.map((entry) => (
            <li key={`${entry.role}-${entry.period}`}>
              <p className={styles.role}>{entry.role}</p>
              <p className={styles.text}>
                {entry.org} · {entry.period}
              </p>
            </li>
          ))}
        </ul>

        <h4 className={styles.heading}>Skills</h4>
        <ul className={styles.skills}>
          {candidate.skills.map((skill) => (
            <li key={skill}>
              <PillBadge>{skill}</PillBadge>
            </li>
          ))}
        </ul>

        <h4 className={styles.heading}>Education</h4>
        <p className={styles.role}>{education.degree}</p>
        <p className={styles.text}>Sample education · {education.period}</p>
      </article>
    </Modal>
  )
}
