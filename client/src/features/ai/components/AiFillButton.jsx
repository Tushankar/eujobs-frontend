import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Sparkles, Undo2 } from 'lucide-react'
import { Button, Icon } from '@/components/ui'
import AiButton from './AiButton.jsx'
import AiStatus from './AiStatus.jsx'
import styles from './AiFillButton.module.css'

/**
 * "Write with AI" for a form (owner 2026-11-17): `request()` resolves the AI answer, `apply(answer)` puts it into the
 * form, and Undo restores what `snapshot()` returned before. Nothing is saved until the person saves the form. Without
 * the plan's AI the button shows a lock and opens the upgrade dialog (AiButton).
 */
export default function AiFillButton({ request, apply, snapshot, restore, label, done, disabled, ...rest }) {
  const { t } = useTranslation('ai')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [previous, setPrevious] = useState(null)

  async function run() {
    setLoading(true)
    setError(null)
    try {
      const before = snapshot()
      apply(await request())
      setPrevious({ value: before })
    } catch (failure) {
      setError(failure)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.fill}>
      <AiButton variant="outline" size="sm" leftIcon={<Icon as={Sparkles} size={13} />} loading={loading} disabled={disabled} onClick={run} {...rest}>
        {label ?? t('fill.action')}
      </AiButton>
      <AiStatus isLoading={false} error={error} onRetry={run}>
        {previous && (
          <p className={styles.done} role="status">
            {done ?? t('fill.done')}
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<Icon as={Undo2} size={13} />}
              onClick={() => {
                restore(previous.value)
                setPrevious(null)
              }}
            >
              {t('fill.undo')}
            </Button>
          </p>
        )}
      </AiStatus>
    </div>
  )
}
