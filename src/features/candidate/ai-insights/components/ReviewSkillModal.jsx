import { useState } from 'react'
import { Check } from 'lucide-react'
import { Button, Checkbox, Icon, Modal } from '@/components/ui'
import PillBadge from '@/components/common/PillBadge.jsx'
import styles from './ReviewSkillModal.module.css'

function ReviewBody({ skill, onClose, onConfirm }) {
  const [confirmed, setConfirmed] = useState(false)
  return (
    <div className={styles.body}>
      <p className={styles.text}>
        You control what belongs in your profile. Add this skill only if it accurately represents your experience. This does not
        edit your resume or certify proficiency.
      </p>
      <div className={styles.chips}>
        <PillBadge tone="accent">{skill}</PillBadge>
        <PillBadge>Candidate-reviewed</PillBadge>
      </div>
      <Checkbox className={styles.confirm} checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} data-autofocus>
        I confirm that {skill} is part of my experience and want to add it to my profile.
      </Checkbox>
      <div className={styles.actions}>
        <Button variant="outline" onClick={onClose}>
          Keep my profile unchanged
        </Button>
        <Button
          className={styles.add}
          disabled={!confirmed}
          onClick={() => onConfirm(skill)}
          rightIcon={<Icon as={Check} size={13} strokeWidth={2} />}
        >
          Add reviewed skill
        </Button>
      </div>
    </div>
  )
}

/** Review step before a skill is added: nothing changes until the candidate confirms. `skill` null = closed. */
export default function ReviewSkillModal({ skill, onClose, onConfirm }) {
  return (
    <Modal open={Boolean(skill)} onClose={onClose} title={`Review ${skill} before adding it`} width={512} className={styles.dialog}>
      {skill && <ReviewBody key={skill} skill={skill} onClose={onClose} onConfirm={onConfirm} />}
    </Modal>
  )
}
