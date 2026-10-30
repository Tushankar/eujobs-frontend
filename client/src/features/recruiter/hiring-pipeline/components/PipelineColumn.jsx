import { cx } from '@/utils/cx.js'
import styles from './PipelineColumn.module.css'

/** One board column: dot + stage name + count, with the cards as children. Accepts dropped cards. */
export default function PipelineColumn({ stage, count, isDropTarget, onDragOver, onDragLeave, onDrop, children }) {
  return (
    <section
      className={cx(styles.column, isDropTarget && styles.dropTarget)}
      aria-labelledby={`stage-${stage.id}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <header className={styles.header}>
        <span className={cx(styles.dot, styles[stage.tone])} aria-hidden="true" />
        <h2 className={styles.name} id={`stage-${stage.id}`}>
          {stage.name}
        </h2>
        <span className={styles.count}>{count}</span>
      </header>
      {count === 0 ? (
        <p className={styles.empty}>
          A little space for your next move.
          <br />
          Drop a candidate here.
        </p>
      ) : (
        <div className={styles.cards}>{children}</div>
      )}
    </section>
  )
}
