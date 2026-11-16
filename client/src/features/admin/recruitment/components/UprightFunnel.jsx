import { cx } from '@/utils/cx.js'
import styles from './UprightFunnel.module.css'

/**
 * The funnel turned upright for phones (owner 2026-11-16), shown in place of the wide drawing below 640px by the admin
 * Recruitment funnel and the recruiter's Hiring pipeline: one band per stage, narrowing downward, with the stage's
 * name, count and an optional detail line beside it. Each stage is a button; `props` carries its label and handlers.
 * `stages` = [{ key, name, count, detail?, fill, icon, selected, dropping?, props }].
 */
export default function UprightFunnel({ label, stages }) {
  return (
    <ol className={styles.upright} aria-label={label}>
      {stages.map((stage, index) => {
        const top = 100 - (55 * index) / stages.length
        const bottom = 100 - (55 * (index + 1)) / stages.length
        return (
          <li key={stage.key}>
            <button type="button" className={cx(styles.stage, stage.selected && styles.selected, stage.dropping && styles.dropping)} {...stage.props}>
              <span className={styles.bandCell}>
                <span className={styles.band} style={{ '--top': `${top}%`, '--inset': `${((top - bottom) / 2 / top) * 100}%`, '--fill': stage.fill }}>
                  <img src={stage.icon} alt="" width={22} height={22} />
                </span>
              </span>
              <span className={styles.text}>
                <span className={styles.name}>{stage.name}</span>
                <span className={styles.count}>{stage.count}</span>
                {stage.detail && <span className={styles.detail}>{stage.detail}</span>}
              </span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}
