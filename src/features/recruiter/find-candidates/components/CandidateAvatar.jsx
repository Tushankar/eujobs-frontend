import { cx } from '@/utils/cx.js'
import styles from './CandidateAvatar.module.css'

/** Initials chip in the candidate's own avatar colours (Figma uses a different pastel per person). */
export default function CandidateAvatar({ candidate, size = 48, className }) {
  return (
    <span
      className={cx(styles.avatar, className)}
      style={{ width: size, height: size, background: candidate.avatar.bg, color: candidate.avatar.fg }}
      role="img"
      aria-label={candidate.name}
    >
      {candidate.initials}
    </span>
  )
}
