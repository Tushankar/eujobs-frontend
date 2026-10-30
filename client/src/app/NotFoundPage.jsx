import { Link, useLocation } from 'react-router-dom'
import { Button, Panel } from '@/components/ui'
import styles from './NotFoundPage.module.css'

/** Shown for any URL that has no matching route (inside a workspace shell or standalone). */
export default function NotFoundPage({ homePath = '/sign-in', homeLabel = 'Go to sign in' }) {
  const { pathname } = useLocation()
  return (
    <div className={styles.wrapper}>
      <Panel padding={32} className={styles.panel}>
        <p className={styles.code}>404</p>
        <h1 className={styles.title}>Page not found</h1>
        <p className={styles.text}>
          There is nothing at <code>{pathname}</code>.
        </p>
        <Button as={Link} to={homePath}>
          {homeLabel}
        </Button>
      </Panel>
    </div>
  )
}
