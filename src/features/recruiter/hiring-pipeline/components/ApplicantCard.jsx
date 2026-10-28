import { Link } from 'react-router-dom'
import { Clock, Sparkles } from 'lucide-react'
import { Avatar, Icon } from '@/components/ui'
import PillBadge from '@/components/common/PillBadge.jsx'
import { cx } from '@/utils/cx.js'
import StageSelect from './StageSelect.jsx'
import styles from './ApplicantCard.module.css'

/** Board card for one applicant. Draggable; the stage menu is the keyboard-accessible way to move it. */
export default function ApplicantCard({ applicant, stages, dragging, onStageChange, onDragStart, onDragEnd }) {
  return (
    <article
      className={cx(styles.card, dragging && styles.dragging)}
      draggable
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = 'move'
        event.dataTransfer.setData('text/plain', applicant.id)
        onDragStart(applicant.id)
      }}
      onDragEnd={onDragEnd}
    >
      <div className={styles.head}>
        <Avatar name={applicant.name} size={36} colors={applicant.avatar} className={styles.avatar} />
        <Link to={`/recruiter/find-candidates/${applicant.id}`} className={styles.name}>
          {applicant.name}
        </Link>
      </div>
      <p className={styles.role}>{applicant.title}</p>
      <p className={styles.meta}>
        {applicant.experienceYears} years · {applicant.workMode}
      </p>
      <div>
        <PillBadge tone="accent">
          <Icon as={Sparkles} size={10} />
          {applicant.alignedSkills} aligned skills
        </PillBadge>
      </div>
      <div className={styles.footer}>
        <StageSelect
          variant="card"
          options={stages}
          value={applicant.stageId}
          label={`Move ${applicant.name} to stage`}
          onChange={onStageChange}
        />
        <p className={styles.activity}>
          <Icon as={Clock} size={10} />
          Demo profile activity
        </p>
      </div>
    </article>
  )
}
