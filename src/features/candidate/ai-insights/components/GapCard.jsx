import { Link } from 'react-router-dom'
import { ArrowRight, Check, GraduationCap, Plus, Undo2 } from 'lucide-react'
import { Button, Icon, Panel } from '@/components/ui'
import PillBadge from '@/components/common/PillBadge.jsx'
import { DEFAULT_GUIDANCE, SKILL_GUIDANCE } from '../data/insights.js'
import styles from './GapCard.module.css'

/**
 * A required skill that is not listed in the reviewed profile. The candidate decides: review and add it,
 * plan to learn it, or leave the profile unchanged. An added skill stays visible here with an undo.
 */
export default function GapCard({ skill, added, planned, onReview, onUndo, onTogglePlan }) {
  return (
    <Panel as="article" padding={24} className={styles.card}>
      <div className={styles.head}>
        <h3 className={styles.title}>{skill}</h3>
        {added ? (
          <PillBadge tone="success">
            <Icon as={Check} size={11} strokeWidth={2} />
            Added · Candidate-reviewed
          </PillBadge>
        ) : (
          <PillBadge tone="warning">Required · Not listed</PillBadge>
        )}
      </div>
      {added ? (
        <p className={styles.text}>
          You reviewed and confirmed {skill}. It now counts in these comparisons and is saved on this device. Your resume is unchanged.
        </p>
      ) : (
        <>
          <p className={styles.text}>
            This role lists {skill}, but it isn’t in your reviewed profile. You may already have relevant experience—confirm it
            rather than letting a missing field speak for you.
          </p>
          <div className={styles.tip}>
            <p className={styles.tipTitle}>A practical way to build evidence</p>
            <p className={styles.tipText}>{SKILL_GUIDANCE[skill] ?? DEFAULT_GUIDANCE}</p>
          </div>
        </>
      )}
      <div className={styles.actions}>
        {added ? (
          <>
            <Button variant="outline" onClick={() => onUndo(skill)} leftIcon={<Icon as={Undo2} size={13} strokeWidth={2} />}>
              Undo
            </Button>
            <Button as={Link} to="/candidate/profile" variant="ghost" className={styles.quiet} rightIcon={<Icon as={ArrowRight} size={13} strokeWidth={2} />}>
              Review my profile
            </Button>
          </>
        ) : (
          <>
            <Button variant="outline" onClick={() => onReview(skill)} rightIcon={<Icon as={Plus} size={13} strokeWidth={2} />}>
              I have this skill
            </Button>
            <Button
              variant="ghost"
              className={styles.quiet}
              aria-pressed={planned}
              onClick={() => onTogglePlan(skill)}
              rightIcon={<Icon as={planned ? Check : ArrowRight} size={13} strokeWidth={2} />}
            >
              {planned ? 'In your learning plan' : 'Add to learning plan'}
            </Button>
            <Button
              as={Link}
              to="/candidate/learning"
              variant="ghost"
              className={styles.quiet}
              rightIcon={<Icon as={GraduationCap} size={13} strokeWidth={2} />}
            >
              Find a course
            </Button>
          </>
        )}
      </div>
    </Panel>
  )
}
