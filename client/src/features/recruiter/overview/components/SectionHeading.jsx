import styles from './SectionHeading.module.css'

/** Overview section title: Manrope 18 heading with an optional muted description. */
export default function SectionHeading({ title, description, id }) {
  return (
    <div>
      <h2 className={styles.title} id={id}>
        {title}
      </h2>
      {description && <p className={styles.description}>{description}</p>}
    </div>
  )
}
