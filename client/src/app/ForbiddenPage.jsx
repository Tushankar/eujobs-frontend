import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button, Panel } from '@/components/ui'
import styles from './NotFoundPage.module.css'

/** OD16, M-155: a direct URL to an admin page the role does not open. The server refuses its data too. */
export default function ForbiddenPage({ permission, homePath }) {
  const { t } = useTranslation()
  return (
    <div className={styles.wrapper}>
      <Panel padding={32} className={styles.panel} data-forbidden={permission}>
        <p className={styles.code}>403</p>
        <h1 className={styles.title}>{t('shell:forbidden.title')}</h1>
        <p className={styles.text}>{t('shell:forbidden.text', { permission: t(`enums:permission.${permission}`) })}</p>
        <Button as={Link} to={homePath}>
          {t('shell:forbidden.home')}
        </Button>
      </Panel>
    </div>
  )
}
