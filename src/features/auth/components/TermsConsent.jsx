import { Checkbox } from '@/components/ui'
import styles from './TermsConsent.module.css'

/** Bordered terms checkbox of the recruiter account forms (sign-up and onboarding step 1). */
export default function TermsConsent({ checked, onChange, error }) {
  return (
    <div>
      <Checkbox className={styles.box} name="terms" checked={checked} onChange={onChange} aria-invalid={Boolean(error) || undefined}>
        I accept the Terms of Service and Privacy Policy and confirm that I am authorized to register this recruiter
        account.
      </Checkbox>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
