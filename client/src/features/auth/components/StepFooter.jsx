import { useTranslation } from 'react-i18next'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { Button, Icon } from '@/components/ui'
import styles from './StepFooter.module.css'

/**
 * Back / primary action row under every onboarding step. The primary button submits the
 * step's <form>; `backDisabled` is used on the first step (the Figma frame dims Back).
 */
export default function StepFooter({ onBack, backDisabled = false, submitLabel, loading = false, submitDisabled = false }) {
  const { t } = useTranslation()
  return (
    <div className={styles.footer}>
      <Button variant="outline" disabled={backDisabled} onClick={onBack} leftIcon={<Icon as={ArrowLeft} size={14} />}>
        {t('auth:onboarding.back')}
      </Button>
      <Button type="submit" className={styles.primary} loading={loading} disabled={submitDisabled} rightIcon={<Icon as={ArrowRight} size={14} />}>
        {submitLabel ?? t('auth:onboarding.continue')}
      </Button>
    </div>
  )
}
