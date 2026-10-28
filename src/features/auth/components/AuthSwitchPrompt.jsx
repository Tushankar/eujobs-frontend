import { Link } from 'react-router-dom'
import { canFlip, markFlip } from '@/utils/pageFlip.js'
import styles from './AuthSwitchPrompt.module.css'

/** "New to matchpoint? Sign up" / "Already have an account? Sign in" line under an auth form. The page flips to the other screen. */
export default function AuthSwitchPrompt({ children, linkTo, linkLabel }) {
  return (
    <p className={styles.prompt}>
      {children}{' '}
      <Link to={linkTo} className={styles.link} viewTransition={canFlip()} onClick={markFlip}>
        {linkLabel}
      </Link>
    </p>
  )
}
