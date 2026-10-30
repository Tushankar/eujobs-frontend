import { ArrowRight } from 'lucide-react'
import { Button, Icon } from '@/components/ui'
import styles from './CreateAccountButton.module.css'

/** Full-width "Create account" submit button; dimmed (as in the Figma frames) until the terms are accepted. */
export default function CreateAccountButton({ loading, disabled }) {
  return (
    <Button
      type="submit"
      fullWidth
      loading={loading}
      disabled={disabled}
      className={styles.button}
      rightIcon={<Icon as={ArrowRight} size={14} />}
    >
      {loading ? 'Creating account…' : 'Create account'}
    </Button>
  )
}
