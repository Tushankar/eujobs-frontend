import { cx } from '@/utils/cx.js'
import styles from './SkillPills.module.css'

/** Skills as neutral outlined pills (job card, job details). */
export default function SkillPills({ skills, label, className }) {
  return (
    <ul className={cx(styles.list, className)} aria-label={label}>
      {skills.map((skill) => (
        <li key={skill} className={styles.pill}>
          {skill}
        </li>
      ))}
    </ul>
  )
}
