import { useId } from 'react'
import { useNavigate } from 'react-router-dom'
import { cx } from '@/utils/cx.js'
import { Icon } from '@/components/ui'
import styles from './WorkspacePicker.module.css'

/**
 * "Choose your workspace" radio group of the Authentication frames. Choosing another
 * workspace opens the same screen for that workspace (`choice.path`). A single choice
 * (admin sign-in) is shown selected and static.
 */
export default function WorkspacePicker({ choices, activeId, helper }) {
  const navigate = useNavigate()
  const labelId = useId()
  const isSingle = choices.length === 1

  return (
    <div className={styles.picker}>
      <p className={styles.label} id={labelId}>
        Choose your workspace
      </p>
      <div className={cx(styles.choices, isSingle && styles.single)} role="radiogroup" aria-labelledby={labelId}>
        {choices.map((choice) => {
          const active = choice.id === activeId
          const content = (
            <>
              <Icon as={choice.icon} size={20} />
              {choice.label}
            </>
          )
          return isSingle ? (
            <div key={choice.id} role="radio" aria-checked="true" className={cx(styles.choice, styles.choiceActive)}>
              {content}
            </div>
          ) : (
            <button
              key={choice.id}
              type="button"
              role="radio"
              aria-checked={active}
              className={cx(styles.choice, active && styles.choiceActive)}
              onClick={() => !active && navigate(choice.path, { replace: true })}
            >
              {content}
            </button>
          )
        })}
      </div>
      <p className={styles.helper}>{helper}</p>
    </div>
  )
}
