import { ArrowLeft, ArrowRight } from 'lucide-react'
import { Button, Icon } from '@/components/ui'
import styles from './StepFooter.module.css'

/**
 * Back / primary action row under every onboarding step. The primary button submits the
 * step's <form>; `backDisabled` is used on the first step (the Figma frame dims Back).
 */
export default function StepFooter({ onBack, backDisabled = false, submitLabel = 'Continue', loading = false }) {
  return (
    <div className={styles.footer}>
      <Button variant="outline" disabled={backDisabled} onClick={onBack} leftIcon={<Icon as={ArrowLeft} size={14} />}>
        Back
      </Button>
      <Button type="submit" className={styles.primary} loading={loading} rightIcon={<Icon as={ArrowRight} size={14} />}>
        {submitLabel}
      </Button>
    </div>
  )
}
