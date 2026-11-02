import { useTranslation } from 'react-i18next'
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
