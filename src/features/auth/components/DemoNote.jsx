import styles from './DemoNote.module.css'

/** The "Demo only" disclaimer box at the bottom of the auth forms (copy from the Figma frames). */
export default function DemoNote() {
  return (
    <p className={styles.note}>
      Demo only. Credentials are not sent or stored. Production authentication, email verification, and access control
      are not connected.
    </p>
  )
}
