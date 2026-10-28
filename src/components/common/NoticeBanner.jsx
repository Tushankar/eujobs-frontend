import styles from './NoticeBanner.module.css'

/** Polite green confirmation line shown above a list after an action (role created, course saved ...). */
export default function NoticeBanner({ children }) {
  return (
    <p className={styles.notice} role="status">
      {children}
    </p>
  )
}
