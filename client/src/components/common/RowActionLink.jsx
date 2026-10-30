import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { Button, Icon } from '@/components/ui'
import styles from './RowActionLink.module.css'

/** Quiet table row action ("Manage →", "Review →"): a ghost link button with a trailing arrow. */
export default function RowActionLink({ to, children, ...rest }) {
  return (
    <Button as={Link} to={to} variant="ghost" className={styles.link} rightIcon={<Icon as={ArrowRight} size={12} />} {...rest}>
      {children}
    </Button>
  )
}
