import { useTranslation } from 'react-i18next'
import styles from './AuthIntro.module.css'

/** Eyebrow + page title (+ optional lead) at the top of the Authentication form column. */
export default function AuthIntro({ title, lead }) {
  const { t } = useTranslation()
  return (
    <>
      <p className={styles.eyebrow}>{t('auth:intro.eyebrow')}</p>
      <h1 className={styles.title}>{title}</h1>
      {lead && <p className={styles.lead}>{lead}</p>}
    </>
  )
}
