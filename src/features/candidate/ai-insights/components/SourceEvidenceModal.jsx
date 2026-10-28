import { Link } from 'react-router-dom'
import { Button, Modal } from '@/components/ui'
import { PROFILE } from '../data/insights.js'
import styles from './SourceEvidenceModal.module.css'

/** The reviewed profile fields and the role listing behind a comparison. Provided locally, not verified. */
export default function SourceEvidenceModal({ open, onClose, role, skills }) {
  const sections = [
    [
      'Your reviewed profile',
      [
        ['Skills listed', skills.join(', ')],
        ['Experience reported', `${PROFILE.yearsReported} years`],
        ['Work preference', PROFILE.workPreference],
        ['Location', PROFILE.location],
      ],
    ],
    [
      `Listing: ${role.title} · ${role.company}`,
      [
        ['Required skills', role.requiredSkills.join(', ')],
        ['Relevant experience', `${role.minYears}+ years`],
        ['Work mode', role.workMode],
        ['Location', role.location],
      ],
    ],
  ]
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Source evidence"
      description="The fields behind this comparison. Provided locally, not independently verified."
      width={560}
    >
      <div className={styles.body}>
        {sections.map(([heading, rows]) => (
          <section key={heading}>
            <h3 className={styles.heading}>{heading}</h3>
            <dl className={styles.list}>
              {rows.map(([label, value]) => (
                <div key={label} className={styles.row}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
        <div className={styles.actions}>
          <Button as={Link} to="/candidate/profile" variant="outline">
            Review profile fields
          </Button>
          <Button onClick={onClose}>Close</Button>
        </div>
      </div>
    </Modal>
  )
}
