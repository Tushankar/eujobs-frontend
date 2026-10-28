import { Link } from 'react-router-dom'
import styles from './AuthSwitchPrompt.module.css'

/** "New to matchpoint? Sign up" / "Already have an account? Sign in" line under an auth form. */
export default function AuthSwitchPrompt({ children, linkTo, linkLabel }) {
  return (
    <p className={styles.prompt}>
      {children}{' '}
      <Link to={linkTo} className={styles.link}>
        {linkLabel}
      </Link>
    </p>
  )
}
