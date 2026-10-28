import { cx } from '@/utils/cx.js'
import { PasswordField, TextField } from '@/components/ui'
import hintStyles from './compactHint.module.css'
import styles from './RecruiterAccountFields.module.css'

/**
 * The six recruiter account fields, shared by the recruiter sign-up (one column) and the
 * onboarding "Account registration" step (two columns). Controlled by the parent form.
 */
export default function RecruiterAccountFields({ values, errors, onChange, columns = 2, showPlaceholders = false }) {
  return (
    <div className={cx(styles.grid, columns === 1 && styles.single)}>
      <TextField
        label="Full name"
        name="fullName"
        autoComplete="name"
        placeholder={showPlaceholders ? 'Alex Morgan' : undefined}
        value={values.fullName}
        onChange={onChange('fullName')}
        error={errors.fullName}
      />
      <TextField
        label="Job title or role"
        name="jobTitle"
        autoComplete="organization-title"
        value={values.jobTitle}
        onChange={onChange('jobTitle')}
        error={errors.jobTitle}
      />
      <TextField
        label="Work email"
        name="workEmail"
        type="email"
        autoComplete="email"
        placeholder={showPlaceholders ? 'you@company.com' : undefined}
        value={values.workEmail}
        onChange={onChange('workEmail')}
        error={errors.workEmail}
      />
      <TextField
        label="Phone number"
        name="phone"
        type="tel"
        autoComplete="tel"
        value={values.phone}
        onChange={onChange('phone')}
        error={errors.phone}
      />
      <PasswordField
        className={hintStyles.compactHint}
        label="Password"
        name="password"
        autoComplete="new-password"
        placeholder="Enter your password"
        hint="Use at least 8 characters. Don’t use a real password in this demo."
        value={values.password}
        onChange={onChange('password')}
        error={errors.password}
      />
      <PasswordField
        label="Confirm password"
        name="confirmPassword"
        autoComplete="new-password"
        placeholder="Re-enter your password"
        value={values.confirmPassword}
        onChange={onChange('confirmPassword')}
        error={errors.confirmPassword}
      />
    </div>
  )
}
