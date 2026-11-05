import { useTranslation } from 'react-i18next'
import { Skeleton } from '@/components/ui'
import { cx } from '@/utils/cx.js'
import styles from './PipelineColumn.module.css'

/** One board column: dot + stage name + count, with the cards as children. Accepts dropped cards. */
export default function PipelineColumn({ stage, count, isDropTarget, onDragOver, onDragLeave, onDrop, children }) {
  const { t } = useTranslation()
  return (
    <section
      className={cx(styles.column, isDropTarget && styles.dropTarget)}
      aria-labelledby={`stage-${stage.id}`}
      data-column={stage.name}
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
          {t('applications:board.empty')}
          <br />
          {t('applications:board.emptyDrop')}
        </p>
      ) : (
        <div className={styles.cards}>{children}</div>
      )}
    </section>
  )
}

/** A column's shape while the board loads: header placeholders over `children` (placeholder cards). */
export function PipelineColumnSkeleton({ children }) {
  return (
    <div className={styles.column} aria-hidden="true">
      <div className={styles.header}>
        <Skeleton shape="circle" width={6} height={6} />
        <span className={styles.name}>
          <Skeleton width={72} />
        </span>
        <Skeleton width={24} height={19} />
      </div>
      <div className={styles.cards}>{children}</div>
    </div>
  )
}
