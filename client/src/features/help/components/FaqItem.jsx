import { useId } from 'react'
import { Plus } from 'lucide-react'
import { cx } from '@/utils/cx.js'
import { Icon } from '@/components/ui'
import styles from './FaqItem.module.css'

/** One disclosure row of the FAQ: the question toggles its answer (the plus turns into a close mark when open). */
export default function FaqItem({ question, answer, open, onToggle }) {
  const id = useId()
  const buttonId = `${id}-question`
  const panelId = `${id}-answer`

  return (
    <div className={styles.item}>
      <h2 className={styles.heading}>
        <button
          type="button"
          id={buttonId}
          className={styles.summary}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggle}
        >
          {question}
          <Icon as={Plus} size={14} strokeWidth={2} className={cx(styles.icon, open && styles.iconOpen)} />
        </button>
      </h2>
      <div id={panelId} role="region" aria-labelledby={buttonId} hidden={!open} className={styles.answer}>
        {answer}
      </div>
    </div>
  )
}
