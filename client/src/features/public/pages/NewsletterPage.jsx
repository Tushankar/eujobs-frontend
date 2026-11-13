import { useTranslation } from 'react-i18next'
import { Navigate, useParams, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui'
import { useDocumentTitle } from '@/components/layout/useDocumentTitle.js'
import { useErrorText } from '@/lib/forms.js'
import { useConfirmNewsletterMutation, useUnsubscribeNewsletterMutation } from '../api.js'
import PublicShell from '../components/PublicShell.jsx'
import { ArrowPill } from '../components/landing/LandingHero.jsx'
import landing from '../components/landing/Landing.module.css'
import styles from '../components/PublicShell.module.css'

const ACTIONS = ['confirm', 'unsubscribe']

/**
 * /newsletter/confirm and /newsletter/unsubscribe?token= from the double opt-in email (2026-11-13). The visitor presses
 * the button, so mail scanners that open links cannot confirm or unsubscribe on their own.
 */
export default function NewsletterPage() {
  const { t } = useTranslation()
  const errorText = useErrorText()
  const { action } = useParams()
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const [confirm, confirmState] = useConfirmNewsletterMutation()
  const [unsubscribe, unsubscribeState] = useUnsubscribeNewsletterMutation()
  const state = action === 'confirm' ? confirmState : unsubscribeState
  useDocumentTitle(t('website:newsletter.title'))
  if (!ACTIONS.includes(action)) return <Navigate to="/" replace />

  const run = () => (action === 'confirm' ? confirm(token) : unsubscribe(token))
  const done = state.isSuccess
  return (
    <PublicShell>
      <section className={`${landing.card} ${styles.panel}`}>
        <div className={styles.notice}>
          <h1 className={styles.title}>{t(`website:newsletter.${action}.${done ? 'doneTitle' : 'title'}`)}</h1>
          <p className={styles.lead}>{t(`website:newsletter.${action}.${done ? 'doneText' : 'text'}`)}</p>
          {state.isError && (
            <p className={styles.empty} role="alert">
              {errorText.code(state.error)}
            </p>
          )}
          <div className={styles.actions}>
            {done || !token ? (
              <ArrowPill to="/">{t('website:newsletter.home')}</ArrowPill>
            ) : (
              <Button loading={state.isLoading} onClick={run} variant={action === 'confirm' ? 'primary' : 'secondary'}>
                {t(`website:newsletter.${action}.button`)}
              </Button>
            )}
          </div>
        </div>
      </section>
    </PublicShell>
  )
}
