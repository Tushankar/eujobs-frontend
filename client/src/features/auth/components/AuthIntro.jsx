import styles from './AuthIntro.module.css'

/** Eyebrow + page title (+ optional lead) at the top of the Authentication form column. */
export default function AuthIntro({ title, lead }) {
  return (
    <>
      <p className={styles.eyebrow}>Your next chapter starts here</p>
      <h1 className={styles.title}>{title}</h1>
      {lead && <p className={styles.lead}>{lead}</p>}
    </>
  )
}
