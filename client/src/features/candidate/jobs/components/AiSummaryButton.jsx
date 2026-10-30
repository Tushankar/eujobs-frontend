import { Button } from '@/components/ui'
import aiGlyph from '@/assets/icons/ai-glyph-blue.svg'
import styles from './AiSummaryButton.module.css'

/** Outlined "Ai Job Summary" button shown in the title row of Find jobs, Job details and Applications. */
export default function AiSummaryButton({ onClick, disabled }) {
  return (
    <Button
      variant="secondary"
      className={styles.button}
      onClick={onClick}
      disabled={disabled}
      leftIcon={<img src={aiGlyph} alt="" width={16} height={16} />}
    >
      Ai Job Summary
    </Button>
  )
}
