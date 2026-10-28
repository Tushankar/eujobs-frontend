import { PIPELINE_STAGES } from '../data/recruitment.js'
import { cx } from '@/utils/cx.js'
import styles from './PipelineStages.module.css'

/** Six stage counters (Applied ... Hired) computed from the candidate list. Selecting one filters the movement table. */
export default function PipelineStages({ candidates, selectedStage, onSelectStage }) {
  return (
    <ul className={styles.grid} aria-label="Pipeline stages">
      {PIPELINE_STAGES.map((stage) => {
        const count = candidates.filter((candidate) => candidate.stage === stage).length
        const active = stage === selectedStage
        return (
          <li key={stage}>
            <button
              type="button"
              className={cx(styles.card, active && styles.active)}
              aria-pressed={active}
              onClick={() => onSelectStage(stage)}
            >
              <span className={styles.label}>{stage}</span>
              <span className={styles.value}>{count}</span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
