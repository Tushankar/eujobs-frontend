import { cx } from '@/utils/cx.js'
import styles from './GetStartedCard.module.css'

/**
 * A list with no records at all: one card that explains the flow in numbered steps and offers the one action
 * (instead of filters that have nothing to filter). `steps` is [{ title, text }].
 */
export default function GetStartedCard({ id, title, text, steps, action, className }) {
  return (
    <section className={cx(styles.card, className)} aria-labelledby={id} data-get-started>
      <div className={styles.head}>
        <h2 id={id} className={styles.title}>
          {title}
        </h2>
        <p className={styles.text}>{text}</p>
      </div>
      <ol className={styles.steps}>
        {steps.map((step, index) => (
          <li key={step.title} className={styles.step}>
            <span className={styles.number}>{index + 1}</span>
            <span className={styles.stepTitle}>{step.title}</span>
            <span className={styles.stepText}>{step.text}</span>
          </li>
        ))}
      </ol>
      <div className={styles.action}>{action}</div>
    </section>
  )
}
