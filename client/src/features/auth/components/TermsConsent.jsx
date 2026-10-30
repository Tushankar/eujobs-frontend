import { Trans } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Checkbox } from '@/components/ui'
import styles from './TermsConsent.module.css'

/** M-191: the required consent of both sign-ups; the links open the current Terms and Privacy texts in a new tab. */
export default function TermsConsent({ checked, onChange, error }) {
  return (
    <div>
      <Checkbox className={styles.box} name="acceptTerms" checked={checked} onChange={onChange} aria-invalid={Boolean(error) || undefined}>
        <Trans
          i18nKey="auth:terms.consent"
          components={{
            terms: <Link to="/legal/terms" target="_blank" className={styles.link} />,
            privacy: <Link to="/legal/privacy" target="_blank" className={styles.link} />,
          }}
        />
      </Checkbox>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
