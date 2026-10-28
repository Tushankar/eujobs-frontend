import styles from './StepHeading.module.css'

/** Title + one-line description at the top of an onboarding step. */
export default function StepHeading({ title, description }) {
  return (
    <div>
      <h2 className={styles.title}>{title}</h2>
      <p className={styles.description}>{description}</p>
    </div>
  )
}
