import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button, Panel } from '@/components/ui'
import styles from './NotFoundPage.module.css'

/** Shown for any URL that has no matching route (inside a workspace shell, or standalone with a sign-in link). */
export default function NotFoundPage({ homePath = '/sign-in', workspaceId }) {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  return (
    <div className={styles.wrapper}>
      <Panel padding={32} className={styles.panel}>
        <p className={styles.code}>404</p>
        <h1 className={styles.title}>{t('shell:notFound.title')}</h1>
        <p className={styles.text}>
          {t('shell:notFound.text')} <code>{pathname}</code>
        </p>
        <Button as={Link} to={homePath}>
          {workspaceId ? t(`shell:workspaces.${workspaceId}.home`) : t('shell:notFound.signIn')}
        </Button>
      </Panel>
    </div>
  )
}
